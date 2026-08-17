/* GitHub sign-in for the article editor at /admin/.
 *
 * WHAT THIS IS FOR
 * The editor runs entirely in your browser and commits posts to GitHub. To do
 * that it needs a GitHub access token, and getting one requires an OAuth
 * "client secret" that must never be shipped to a browser. This worker is the
 * only place that secret lives. It does exactly one thing: swap a GitHub
 * login for a token and hand that token back to the editor.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It cannot write to the site. It has no database and stores nothing. It is
 * not an "upload articles" endpoint — there is no such endpoint anywhere, by
 * design. Authorisation is entirely GitHub's: the token it returns carries
 * only the permissions your GitHub account already has, so a stranger who
 * signs in here gets a token that cannot touch your repository.
 *
 * Three defences against misuse:
 *   1. ALLOWED_ORIGINS — the token is only ever posted back to a site you list.
 *   2. A signed-by-possession state cookie, checked on return, blocks CSRF.
 *   3. The secret stays server-side; the browser never receives it.
 */

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const PROVIDER = "github";
const STATE_COOKIE = "cms_oauth_state";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return text("Worker is not configured: missing GitHub credentials.", 500);
    }

    try {
      if (url.pathname === "/auth") return startSignIn(request, url, env);
      if (url.pathname === "/callback") return finishSignIn(request, url, env);
    } catch (err) {
      return text("Sign-in failed.", 500);
    }

    return text("Not found.", 404);
  },
};

/* ---------------------------------------------------------------- helpers */

const text = (body, status) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });

const allowedOrigins = (env) =>
  (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

// Work out which site opened this popup, and refuse anything not allow-listed.
function resolveOrigin(request, url, env) {
  const allowed = allowedOrigins(env);
  const candidates = [];

  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      candidates.push(new URL(referer).origin);
    } catch (err) {
      /* ignore an unparseable referer */
    }
  }

  const siteId = url.searchParams.get("site_id");
  if (siteId) candidates.push(`https://${siteId}`, `http://${siteId}`);

  return candidates.find((origin) => allowed.includes(origin)) || null;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

// Length-independent comparison, so a mismatch reveals nothing by timing.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* -------------------------------------------------------------- step one */

function startSignIn(request, url, env) {
  const origin = resolveOrigin(request, url, env);
  if (!origin) {
    return text(
      "This site is not allowed to sign in here. Add it to ALLOWED_ORIGINS.",
      403
    );
  }

  const nonce = crypto.randomUUID();
  // The origin is carried in the cookie, which only this worker can set —
  // so a tampered query string cannot redirect the token elsewhere.
  const cookie = btoa(JSON.stringify({ nonce, origin }));

  const authorize = new URL(GITHUB_AUTHORIZE);
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}/callback`);
  authorize.searchParams.set("scope", url.searchParams.get("scope") || "repo");
  authorize.searchParams.set("state", nonce);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}

/* -------------------------------------------------------------- step two */

async function finishSignIn(request, url, env) {
  const clearCookie = `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

  if (url.searchParams.get("error")) {
    return text(`GitHub refused the sign-in: ${url.searchParams.get("error")}`, 400);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const raw = readCookie(request, STATE_COOKIE);
  if (!code || !state || !raw) return text("Sign-in expired. Try again.", 400);

  let stored;
  try {
    stored = JSON.parse(atob(raw));
  } catch (err) {
    return text("Sign-in expired. Try again.", 400);
  }

  if (!safeEqual(state, stored.nonce)) {
    return text("Sign-in could not be verified. Try again.", 400);
  }
  if (!allowedOrigins(env).includes(stored.origin)) {
    return text("This site is not allowed to sign in here.", 403);
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/callback`,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    return text(`GitHub did not return a token: ${data.error || "unknown"}`, 401);
  }

  return new Response(popupPage(data.access_token, stored.origin), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "Set-Cookie": clearCookie,
      // The page is single-use and must never be cached anywhere.
      "Cache-Control": "no-store",
    },
  });
}

/* Hands the token to the editor window, then closes. The token goes to one
   named origin — never "*" — so no other page can receive it. */
function popupPage(token, origin) {
  const payload = JSON.stringify({ token, provider: PROVIDER });
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Signing in…</title></head>
  <body>
    <p>Signing in… you can close this window if it does not close itself.</p>
    <script>
      (function () {
        var target = ${JSON.stringify(origin)};
        var message = "authorization:${PROVIDER}:success:" + ${JSON.stringify(payload)};

        function reply(event) {
          if (event.data !== "authorizing:${PROVIDER}") return;
          window.removeEventListener("message", reply);
          window.opener.postMessage(message, target);
        }

        if (!window.opener) {
          document.body.textContent = "Open the editor and sign in from there.";
          return;
        }
        window.addEventListener("message", reply, false);
        // Announce readiness. This carries no secret, so "*" is safe here.
        window.opener.postMessage("authorizing:${PROVIDER}", "*");
      })();
    </script>
  </body>
</html>`;
}
