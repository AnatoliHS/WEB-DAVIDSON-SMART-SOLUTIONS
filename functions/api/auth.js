// Decap CMS login, step 1: send the editor to GitHub to sign in.
// Needs GITHUB_CLIENT_ID set in the Cloudflare Pages project settings.
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response("GITHUB_CLIENT_ID is not configured.", { status: 500 });
  }

  const url = new URL(request.url);
  const state = crypto.randomUUID();

  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  gh.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
  gh.searchParams.set("scope", "repo,user");
  gh.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: gh.toString(),
      // Checked in /api/callback so only logins started here are accepted.
      "Set-Cookie": `decap_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}
