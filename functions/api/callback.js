// Decap CMS login, step 2: GitHub sends the editor back here with a code.
// We swap the code for an access token and pass it to the CMS window that opened the popup.
// Needs GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET set in the Cloudflare Pages project settings.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = (request.headers.get("Cookie") || "").match(/decap_oauth_state=([^;]+)/)?.[1];

  let status = "error";
  let content = { error: "Invalid login state. Please try again." };

  if (code && state && state === saved) {
    try {
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "decap-cms-oauth",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/api/callback`,
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        status = "success";
        content = { token: data.access_token, provider: "github" };
      } else {
        content = { error: data.error_description || "GitHub token exchange failed." };
      }
    } catch (err) {
      content = { error: "Could not reach GitHub. Please try again." };
    }
  }

  // Decap's popup handshake: announce "authorizing", wait for the CMS to reply,
  // then send the result back. Messages only go to this site's own origin.
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Signing in…</title></head>
<body><p>Signing in…</p><script>
(function () {
  var origin = ${JSON.stringify(url.origin)};
  var message = ${JSON.stringify(message).replace(/</g, "\\u003c")};
  if (!window.opener) {
    document.body.textContent = "Please start the login from the /admin page.";
    return;
  }
  function receive(e) {
    if (e.origin !== origin) return;
    window.removeEventListener("message", receive);
    window.opener.postMessage(message, origin);
  }
  window.addEventListener("message", receive);
  window.opener.postMessage("authorizing:github", origin);
})();
</script></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": "decap_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
