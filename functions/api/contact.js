/**
 * Cloudflare Pages Function: POST /api/contact
 *
 * Verifies the Cloudflare Turnstile token, validates the enquiry, and emails it through Resend.
 * Every response is JSON: { ok: true } or { ok: false, error: <code>, message: <text>, fields?: [...] }.
 * The browser handler (src/assets/js/contact-form.js) maps each error code to a message and fallback.
 *
 * Environment variables (Cloudflare dashboard → Pages project → Settings → Variables and Secrets):
 *   RESEND_API_KEY        secret  Resend API key
 *   TURNSTILE_SECRET_KEY  secret  Turnstile widget secret key
 *   CONTACT_TO_EMAIL      text    Inbox that receives enquiries (comma-separate for several)
 *   CONTACT_FROM_EMAIL    text    Sender on a domain verified in Resend, e.g. "Website <enquiries@yourdomain.ca>"
 *   ALLOWED_ORIGINS       text    Optional. Comma-separated origins allowed to post, e.g. "https://quintesmarthomes.ca"
 */

const LIMITS = { name: 120, email: 254, phone: 40, city: 120, company: 160, budget: 60, message: 5000, source: 200, page: 500 };
const REQUIRED = ['name', 'email', 'phone', 'city', 'message'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FIELD_LABELS = { name: 'Name', email: 'Email', phone: 'Phone', city: 'City', company: 'Company', budget: 'Estimated budget', message: 'Message' };

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const fail = (status, error, message, extra = {}) => json(status, { ok: false, error, message, ...extra });

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clean = (value, max) => String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

async function readBody(request) {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) return await request.json();
  if (type.includes('form')) return Object.fromEntries(await request.formData());
  throw new Error('unsupported content type');
}

async function verifyTurnstile(token, secret, ip) {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
  return res.json();
}

function buildEmail(data) {
  const rows = ['name', 'email', 'phone', 'city', 'company', 'budget']
    .filter((key) => data[key])
    .map((key) => [FIELD_LABELS[key], data[key]]);

  const text = [
    `New enquiry from ${data.source || 'the website'}`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    data.message,
    '',
    data.page ? `Sent from: ${data.page}` : '',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #111; max-width: 620px;">
      <h2 style="margin: 0 0 4px; font-size: 18px;">New website enquiry</h2>
      <p style="margin: 0 0 18px; color: #666; font-size: 13px;">${escapeHtml(data.source || 'Website form')}</p>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding: 6px 12px 6px 0; color: #666; white-space: nowrap; vertical-align: top;">${escapeHtml(label)}</td><td style="padding: 6px 0;">${escapeHtml(value)}</td></tr>`
          )
          .join('')}
      </table>
      <h3 style="margin: 20px 0 6px; font-size: 14px; color: #666;">Message</h3>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(data.message)}</p>
      ${data.page ? `<p style="margin: 22px 0 0; font-size: 12px; color: #999;">Sent from ${escapeHtml(data.page)}</p>` : ''}
    </div>`;

  return { text, html };
}

export async function onRequestPost({ request, env }) {
  // 1. Configuration (missing secrets are a site problem, not the visitor's)
  if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET_KEY || !env.CONTACT_TO_EMAIL || !env.CONTACT_FROM_EMAIL) {
    console.error('contact: missing environment variables');
    return fail(503, 'not_configured', 'The contact form is not configured yet.');
  }

  // 2. Optional origin allow-list
  if (env.ALLOWED_ORIGINS) {
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
    if (origin && !allowed.includes(origin)) return fail(403, 'forbidden_origin', 'Submissions from this site are not accepted.');
  }

  // 3. Parse
  let raw;
  try {
    raw = await readBody(request);
  } catch {
    return fail(400, 'bad_request', 'The form data could not be read.');
  }

  // 4. Honeypot: bots fill the hidden field. Pretend success so they don't retry.
  if (clean(raw.website, 200)) return json(200, { ok: true });

  const data = Object.fromEntries(Object.entries(LIMITS).map(([key, max]) => [key, clean(raw[key], max)]));

  // 5. Validate
  const missing = REQUIRED.filter((key) => !data[key]);
  if (data.email && !EMAIL_RE.test(data.email)) missing.push('email');
  if (missing.length) {
    return fail(422, 'invalid_fields', 'Some fields are missing or invalid.', { fields: [...new Set(missing)] });
  }

  // 6. Turnstile
  const token = clean(raw['cf-turnstile-response'], 2048);
  if (!token) return fail(400, 'turnstile_missing', 'Please complete the security check.');
  try {
    const outcome = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
    if (!outcome.success) {
      const expired = (outcome['error-codes'] || []).includes('timeout-or-duplicate');
      return fail(403, expired ? 'turnstile_expired' : 'turnstile_failed', 'The security check did not pass.');
    }
  } catch (err) {
    console.error('contact: turnstile verification error', err);
    return fail(502, 'turnstile_unavailable', 'The security check could not be verified.');
  }

  // 7. Send through Resend
  const { text, html } = buildEmail(data);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: env.CONTACT_TO_EMAIL.split(',').map((e) => e.trim()).filter(Boolean),
        reply_to: data.email,
        subject: `New enquiry from ${data.name}${data.source ? ` · ${data.source}` : ''}`,
        text,
        html,
      }),
    });
    if (res.status === 429) return fail(429, 'rate_limited', 'Too many messages right now.');
    if (!res.ok) {
      console.error('contact: resend error', res.status, await res.text());
      return fail(502, 'send_failed', 'The message could not be delivered.');
    }
  } catch (err) {
    console.error('contact: resend request failed', err);
    return fail(502, 'send_failed', 'The message could not be delivered.');
  }

  return json(200, { ok: true });
}

// Anything other than POST
export const onRequest = () => fail(405, 'method_not_allowed', 'Use POST.');
