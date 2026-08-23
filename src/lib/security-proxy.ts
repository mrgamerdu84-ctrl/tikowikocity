const GOOGLE_SECURITY_URL =
  "https://script.google.com/macros/s/AKfycbzputvS9vp9KNlKD0PeCYjg_CN6TbuP1fLHltmP7MI8MubnWj_ZIb30Ci88m3h1LMLH3g/exec";

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

    // Apps Script can return valid JSON with a text/plain content type.
    // Read the body as text first and parse it ourselves instead of rejecting
    // the response only because the Content-Type header is not application/json.
    const raw = (await upstream.text()).trim();
    let payload: { valid?: unknown; retryLater?: unknown };

    try {
      payload = JSON.parse(raw) as { valid?: unknown; retryLater?: unknown };
    } catch {
      return json(502, {
        valid: false,
        unavailable: true,
        reason: "google-invalid-response",
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
