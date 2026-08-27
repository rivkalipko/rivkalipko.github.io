// Subscribe endpoint for rivka.me. The site is static, so this Worker is the
// only piece that holds state: a D1 table of email addresses.
//
//   POST /subscribe     add an address (JSON or form-encoded)
//   GET  /subscribers   export the list, bearer token required

const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\"]+@[^\s@.,;:<>()[\]\\"]+(\.[^\s@.,;:<>()[\]\\"]+)+$/;
const THROTTLE_WINDOW_SECONDS = 3600;
const THROTTLE_MAX_ATTEMPTS = 5;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (url.pathname === "/subscribe" && request.method === "POST") {
      return subscribe(request, env, cors);
    }
    if (url.pathname === "/subscribers" && request.method === "GET") {
      return exportList(request, env);
    }
    return new Response("Not found", { status: 404, headers: cors });
  }
};

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// An origin that isn't on the list gets no CORS header at all, so the browser
// refuses to hand the response back to whatever page made the call.
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = { Vary: "Origin" };
  if (origin && allowedOrigins(env).includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

async function readSubmission(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return { email: body.email, trap: body.website, wantsJson: true };
  }
  const form = await request.formData().catch(() => new FormData());
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
  return { email: form.get("email"), trap: form.get("website"), wantsJson };
}

function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

async function hashIp(ip, env) {
  const data = new TextEncoder().encode(`${env.IP_SALT || "rivka-subscribe"}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isThrottled(request, env) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return false;
  const ipHash = await hashIp(ip, env);
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - THROTTLE_WINDOW_SECONDS;

  await env.DB.prepare("DELETE FROM signup_attempts WHERE created_at < ?").bind(cutoff).run();
  const { results } = await env.DB
    .prepare("SELECT COUNT(*) AS attempts FROM signup_attempts WHERE ip_hash = ? AND created_at >= ?")
    .bind(ipHash, cutoff)
    .all();
  if ((results?.[0]?.attempts ?? 0) >= THROTTLE_MAX_ATTEMPTS) return true;

  await env.DB
    .prepare("INSERT INTO signup_attempts (ip_hash, created_at) VALUES (?, ?)")
    .bind(ipHash, now)
    .run();
  return false;
}

function respond({ request, env, cors, wantsJson, status, ok, message }) {
  if (wantsJson) {
    return new Response(JSON.stringify({ ok, error: ok ? undefined : message }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
  // No-JS fallback: bounce back to the page the form was submitted from, but
  // only if it is one of ours, so this can't be used as an open redirect.
  const target = refererWithinSite(request, env);
  if (!target) return new Response(message || "Subscribed.", { status, headers: cors });
  target.searchParams.set("subscribed", ok ? "1" : "0");
  target.hash = "subscribe";
  return Response.redirect(target.toString(), 303);
}

function refererWithinSite(request, env) {
  const referer = request.headers.get("Referer");
  if (!referer) return null;
  try {
    const target = new URL(referer);
    return allowedOrigins(env).includes(target.origin) ? target : null;
  } catch {
    return null;
  }
}

async function subscribe(request, env, cors) {
  const { email, trap, wantsJson } = await readSubmission(request);
  const reply = (status, ok, message) => respond({ request, env, cors, wantsJson, status, ok, message });

  // Hidden field. Humans leave it empty; naive bots fill everything in.
  if (trap) return reply(200, true, "");

  const normalized = normalizeEmail(email);
  if (!normalized) return reply(400, false, "That doesn’t look like a valid email address.");

  try {
    if (await isThrottled(request, env)) {
      return reply(429, false, "Too many signups from this connection. Try again later.");
    }
    await env.DB
      .prepare("INSERT INTO subscribers (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING")
      .bind(normalized, new Date().toISOString())
      .run();
  } catch (error) {
    console.error("subscribe failed", error);
    return reply(500, false, "Something went wrong on our end. Try again in a moment.");
  }
  // Already-subscribed looks identical to a fresh signup, so the endpoint can't
  // be used to test whether a given address is on the list.
  return reply(200, true, "");
}

async function exportList(request, env) {
  const expected = env.EXPORT_TOKEN;
  const provided = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { results } = await env.DB
    .prepare("SELECT email, created_at FROM subscribers ORDER BY created_at")
    .all();
  return new Response(JSON.stringify(results ?? [], null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
