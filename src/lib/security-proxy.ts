const GOOGLE_SECURITY_URL =
  "https://script.google.com/macros/s/AKfycbxpTxHc7McTdbjmFKLNjw3gNHYBX7u2iC6Haft7Yqe06G8Q9GNhevwybNTsFskZliv90Q/exec";

const APP_ID = "pixel-perfect-preview-16";
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;

const failedAttempts = new Map<string, number[]>();

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    forwarded ??
    "unknown";
  return `${APP_ID}:${ip}`;
}

function recentFailures(key: string) {
  const now = Date.now();
  const recent = (failedAttempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  failedAttempts.set(key, recent);
  return recent;
}

function isRateLimited(key: string) {
  return recentFailures(key).length >= MAX_ATTEMPTS;
}

function registerFailure(key: string) {
  const recent = recentFailures(key);
  recent.push(Date.now());
  failedAttempts.set(key, recent);
}

function clearFailures(key: string) {
  failedAttempts.delete(key);
}

function classifyGoogleResponse(raw: string) {
  const lower = raw.toLowerCase();
  if (!raw.trim()) return "google-empty-response";
  if (
    lower.includes("accounts.google.com") ||
    lower.includes("servicelogin") ||
    lower.includes("sign in with google") ||
    lower.includes("connexion avec google")
  ) {
    return "google-login-page";
  }
  if (
    lower.includes("script function not found") ||
    lower.includes("referenceerror") ||
    lower.includes("typeerror") ||
    lower.includes("exception:") ||
    lower.includes("erreur de script")
  ) {
    return "google-script-error";
  }
  if (raw.trimStart().startsWith("<")) return "google-html-response";
  return "google-invalid-response";
}

export async function handleSecurityRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const isSecurityEndpoint =
    url.pathname === "/api/security/verify" ||
    (url.pathname === "/" && request.method === "POST");

  if (!isSecurityEndpoint) return null;

  if (request.method !== "POST") {
    return json(405, { valid: false });
  }

  const key = clientKey(request);
  if (isRateLimited(key)) {
    return json(429, { valid: false, retryLater: true });
  }

  try {
    const body = (await request.json()) as { code?: unknown };
    const code = String(body.code ?? "");
    if (!/^\d{6}$/.test(code)) {
      return json(400, { valid: false });
    }

    const upstream = await fetch(GOOGLE_SECURITY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId: APP_ID, code }),
      redirect: "follow",
    });

    if (!upstream.ok) {
      return json(502, {
        valid: false,
        unavailable: true,
        reason: `google-http-${upstream.status}`,
      });
    }

    const raw = (await upstream.text()).trim();
    let payload: { valid?: unknown; retryLater?: unknown };

    try {
      payload = JSON.parse(raw) as { valid?: unknown; retryLater?: unknown };
    } catch {
      return json(502, {
        valid: false,
        unavailable: true,
        reason: classifyGoogleResponse(raw),
      });
    }

    const valid = payload.valid === true;

    if (valid) {
      clearFailures(key);
      return json(200, { valid: true });
    }

    registerFailure(key);
    return json(401, {
      valid: false,
      retryLater: payload.retryLater === true || isRateLimited(key),
    });
  } catch (error) {
    console.error("TikoWiko Security verification failed", error);
    return json(502, {
      valid: false,
      unavailable: true,
      reason: "google-fetch-error",
    });
  }
}
