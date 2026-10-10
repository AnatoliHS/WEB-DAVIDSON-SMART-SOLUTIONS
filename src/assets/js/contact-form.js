/**
 * Contact form handler for every <form data-contact-form> on the site.
 *
 * - Adds a Cloudflare Turnstile check and a hidden honeypot field to each form
 * - Submits as JSON to the endpoint set in src/_data/site.json (forms.endpoint)
 * - Shows "Message sent" or a specific error at the top of the form; inputs are kept on error
 * - Every error offers fallbacks: try again, email (pre-filled with what they typed) or phone
 *
 * Config arrives on this script's tag: data-endpoint, data-turnstile-sitekey, data-email, data-phone.
 */
(() => {
  const script = document.currentScript;
  const config = {
    endpoint: script?.dataset.endpoint || '',
    siteKey: script?.dataset.turnstileSitekey || '',
    email: script?.dataset.email || '',
    phone: script?.dataset.phone || '',
  };
  const TIMEOUT_MS = 15000;
  const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  const FIELD_NAMES = { name: 'your name', email: 'a valid email address', phone: 'your phone number', city: 'your city', message: 'a message' };

  const forms = [...document.querySelectorAll('form[data-contact-form]')];
  if (!forms.length) return;

  /* ---------- Turnstile loading (once per page, shared by all forms) ---------- */
  let turnstileReady = null;
  const loadTurnstile = () => {
    if (!config.siteKey) return Promise.reject(new Error('no site key'));
    if (turnstileReady) return turnstileReady;
    turnstileReady = new Promise((resolve, reject) => {
      if (window.turnstile) return resolve(window.turnstile);
      const tag = document.createElement('script');
      tag.src = TURNSTILE_SRC;
      tag.async = true;
      tag.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
      tag.onerror = () => reject(new Error('turnstile blocked'));
      document.head.appendChild(tag);
      setTimeout(() => reject(new Error('turnstile timeout')), 12000);
    });
    // Allow a later retry if loading failed (e.g. a blocker was switched off)
    turnstileReady.catch(() => { turnstileReady = null; });
    return turnstileReady;
  };

  /* ---------- Small helpers ---------- */
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const mailtoFor = (form, data) => {
    if (!config.email) return '';
    const details = [
      data.name && `Name: ${data.name}`,
      data.phone && `Phone: ${data.phone}`,
      data.city && `City: ${data.city}`,
      data.company && `Company: ${data.company}`,
      data.budget && `Budget: ${data.budget}`,
    ].filter(Boolean);
    const lines = [data.message || '', '', '—', ...details];
    const subject = `Website enquiry${data.name ? ` from ${data.name}` : ''}`;
    return `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  };

  const readForm = (form) => {
    const data = Object.fromEntries(new FormData(form));
    data.source = form.dataset.formSource || document.title;
    data.page = location.href;
    return data;
  };

  /* ---------- Per-form setup ---------- */
  forms.forEach((form) => {
    const submitBtn = form.querySelector('[type="submit"]');
    const submitHtml = submitBtn ? submitBtn.innerHTML : '';

    // Status message lives at the very top of the form
    const status = el('div', 'form-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    form.prepend(status);

    // Honeypot: invisible to people, tempting to bots
    const trap = el('div', 'form-hp');
    trap.setAttribute('aria-hidden', 'true');
    trap.innerHTML = '<label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>';
    form.appendChild(trap);

    // Turnstile widget sits directly under the row holding the submit button, on every form
    const widgetSlot = el('div', 'form-turnstile');
    let submitRow = submitBtn;
    while (submitRow && submitRow.parentElement !== form) submitRow = submitRow.parentElement;
    if (submitRow) submitRow.after(widgetSlot);
    else form.appendChild(widgetSlot);

    let widgetId = null;
    let busy = false;

    const renderWidget = () =>
      loadTurnstile().then((ts) => {
        if (widgetId !== null) return ts;
        widgetId = ts.render(widgetSlot, {
          sitekey: config.siteKey,
          theme: 'dark',
          size: 'flexible',
          action: 'contact',
          // Tokens expire after 5 minutes; get a fresh one silently
          'refresh-expired': 'auto',
        });
        return ts;
      });

    // Load the check only when the visitor shows interest in this form
    const warmUp = () => renderWidget().catch(() => {});
    form.addEventListener('focusin', warmUp, { once: true });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { warmUp(); io.disconnect(); }
      }, { rootMargin: '300px' });
      io.observe(form);
    }

    const setBusy = (on) => {
      busy = on;
      form.setAttribute('aria-busy', String(on));
      if (!submitBtn) return;
      submitBtn.disabled = on;
      submitBtn.innerHTML = on ? 'SENDING <i class="fa-solid fa-circle-notch fa-spin" style="margin-left: 0.4rem;"></i>' : submitHtml;
    };

    const clearFieldErrors = () => {
      form.querySelectorAll('[aria-invalid="true"]').forEach((f) => f.removeAttribute('aria-invalid'));
    };

    const show = (kind, title, body, actions = []) => {
      status.className = `form-status form-status--${kind}`;
      status.replaceChildren();
      const icon = el('span', 'form-status-icon');
      icon.innerHTML = kind === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
      const text = el('div', 'form-status-text');
      text.append(el('strong', '', title));
      if (body) text.append(el('p', '', body));
      if (actions.length) {
        const row = el('div', 'form-status-actions');
        actions.forEach((a) => row.append(a));
        text.append(row);
      }
      status.append(icon, text);
      status.hidden = false;
      // Bring the message into view without jumping past it
      const top = status.getBoundingClientRect().top;
      if (top < 90 || top > window.innerHeight - 120) status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Fallback actions shown with every error
    const fallbacks = (data, { retry = true } = {}) => {
      const list = [];
      if (retry) {
        const again = el('button', 'form-status-btn', 'Try again');
        again.type = 'button';
        again.addEventListener('click', () => form.requestSubmit ? form.requestSubmit() : submitBtn?.click());
        list.push(again);
      }
      const mail = mailtoFor(form, data);
      if (mail) {
        const a = el('a', 'form-status-link', 'Email us instead');
        a.href = mail;
        list.push(a);
      }
      if (config.phone) {
        const call = el('a', 'form-status-link', `Call ${config.phone}`);
        call.href = `tel:${config.phone.replace(/[^\d+]/g, '')}`;
        list.push(call);
      }
      return list;
    };

    const fail = (data, title, body, opts) => show('error', title, body, fallbacks(data, opts));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      clearFieldErrors();
      const data = readForm(form);

      // Offline: don't even try
      if (navigator.onLine === false) {
        return fail(data, "You're offline.", 'Reconnect to the internet and try again. Your message is still in the form.');
      }

      // The site hasn't been connected to a sending service yet
      if (!config.endpoint) {
        return fail(data, "Online sending isn't available yet.", 'Please email or call us directly. Your message has been copied into the email for you.', { retry: false });
      }

      setBusy(true);

      // Security check
      let token = '';
      try {
        const ts = await renderWidget();
        token = ts.getResponse(widgetId) || '';
        if (!token) {
          setBusy(false);
          return show('error', 'Please complete the security check.', 'Tick the box above the button, then submit again.');
        }
      } catch {
        setBusy(false);
        return fail(data, "The security check couldn't load.", 'An ad or privacy blocker may be stopping it. Allow challenges.cloudflare.com and try again, or contact us directly.');
      }
      data['cf-turnstile-response'] = token;

      // Send, with a timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res;
      let body = {};
      try {
        res = await fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        body = await res.json().catch(() => ({}));
      } catch (err) {
        clearTimeout(timer);
        setBusy(false);
        if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
        return err.name === 'AbortError'
          ? fail(data, 'This is taking too long.', 'Our server did not respond in time. Your message is still in the form. Please try again.')
          : fail(data, "We couldn't reach our server.", 'Check your connection and try again. Your message is still in the form.');
      }
      clearTimeout(timer);
      setBusy(false);
      // Turnstile tokens are single-use: always get a fresh one for the next attempt
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);

      if (res.ok && body.ok) {
        const first = (data.name || '').split(/\s+/)[0];
        form.reset();
        return show('success', 'Message sent.', `Thanks${first ? `, ${first}` : ''}. We've received your enquiry and will reply within one business day.`);
      }

      switch (body.error) {
        case 'invalid_fields': {
          const fields = body.fields || [];
          fields.forEach((name) => form.querySelector(`[name="${name}"]`)?.setAttribute('aria-invalid', 'true'));
          const needs = fields.map((f) => FIELD_NAMES[f]).filter(Boolean);
          form.querySelector('[aria-invalid="true"]')?.focus();
          return show('error', 'Please check the highlighted fields.', needs.length ? `We still need ${needs.join(', ')}.` : '');
        }
        case 'turnstile_missing':
        case 'turnstile_expired':
          return show('error', 'Please complete the security check again.', 'It expired before the form was sent. Tick the box and submit again.');
        case 'turnstile_failed':
          return fail(data, "We couldn't verify you're human.", 'Please try the security check again. If it keeps failing, contact us directly.');
        case 'rate_limited':
          return fail(data, 'Too many messages right now.', 'Please wait a minute and try again, or contact us directly.');
        case 'not_configured':
          return fail(data, "Online sending isn't available right now.", 'Please email or call us directly. Your message has been copied into the email for you.', { retry: false });
        default:
          return fail(data, "Your message wasn't sent.", 'Something went wrong on our side. Your message is still in the form. Please try again, or contact us directly.');
      }
    });

    // Typing in a field clears its error highlight
    form.addEventListener('input', (e) => e.target.removeAttribute?.('aria-invalid'));
  });
})();
