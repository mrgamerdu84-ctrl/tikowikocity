(() => {
  if (window.__TIKOWIKO_SECURITY_CLIENT__) return;
  window.__TIKOWIKO_SECURITY_CLIENT__ = true;

  const ENDPOINT = "https://pixel-perfect-preview-16.lovable.app/";
  const SESSION_KEY = "tikowiko-security-unlocked";
  const MAX_ATTEMPTS = 5;
  const BLOCK_MS = 60_000;
  const script = document.currentScript;
  const appName = script?.dataset?.appName || document.title || "ce jeu";

  function sessionIsUnlocked() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  }

  function saveUnlocked() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // The game still unlocks for the current page even without storage.
    }
  }

  function start() {
    if (sessionIsUnlocked()) return;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const overlay = document.createElement("div");
    overlay.id = "tikowiko-security-gate";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <style>
        #tikowiko-security-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:#070b14;color:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        #tikowiko-security-gate *{box-sizing:border-box}
        #tikowiko-security-card{width:min(390px,100%);padding:28px;border:1px solid #243044;border-radius:28px;background:#101827;box-shadow:0 24px 70px rgba(0,0,0,.45);text-align:center}
        #tikowiko-security-icon{width:68px;height:68px;margin:0 auto 18px;border-radius:20px;display:grid;place-items:center;background:#2563eb;font-size:34px;box-shadow:0 12px 28px rgba(37,99,235,.3)}
        #tikowiko-security-card h1{margin:0;font-size:25px;line-height:1.2}
        #tikowiko-security-card p{margin:9px 0 0;color:#aeb9ca;font-size:14px;line-height:1.45}
        #tikowiko-security-form{margin-top:22px}
        #tikowiko-security-code{width:100%;height:64px;border:1px solid #344158;border-radius:18px;background:#0a111e;color:#fff;text-align:center;font:700 30px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.30em;outline:none;padding-left:.3em}
        #tikowiko-security-code:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18)}
        #tikowiko-security-error{min-height:20px;margin-top:10px;color:#fca5a5;font-size:13px;font-weight:600}
        #tikowiko-security-submit{width:100%;height:50px;margin-top:8px;border:0;border-radius:16px;background:#2563eb;color:#fff;font-size:16px;font-weight:750;cursor:pointer}
        #tikowiko-security-submit:disabled{opacity:.5;cursor:not-allowed}
        #tikowiko-security-note{margin-top:15px!important;font-size:12px!important;color:#7f8ba0!important}
      </style>
      <div id="tikowiko-security-card">
        <div id="tikowiko-security-icon" aria-hidden="true">🔒</div>
        <h1>TikoWiko Security</h1>
        <p>Entre ton code fixe à 6 chiffres pour ouvrir ${escapeHtml(appName)}.</p>
        <form id="tikowiko-security-form">
          <input id="tikowiko-security-code" type="text" inputmode="numeric" autocomplete="off" maxlength="6" pattern="[0-9]{6}" placeholder="000000" aria-label="Code de sécurité à 6 chiffres" />
          <div id="tikowiko-security-error" role="alert"></div>
          <button id="tikowiko-security-submit" type="submit" disabled>Déverrouiller</button>
        </form>
        <p id="tikowiko-security-note">Le code n'est pas enregistré dans le jeu.</p>
      </div>`;

    document.body.appendChild(overlay);

    const form = overlay.querySelector("#tikowiko-security-form");
    const input = overlay.querySelector("#tikowiko-security-code");
    const submit = overlay.querySelector("#tikowiko-security-submit");
    const error = overlay.querySelector("#tikowiko-security-error");
    let attempts = 0;
    let blockedUntil = 0;
    let timer = 0;

    function updateButton() {
      const blocked = Date.now() < blockedUntil;
      submit.disabled = blocked || input.value.length !== 6 || submit.dataset.checking === "1";
    }

    function setBlocked() {
      blockedUntil = Date.now() + BLOCK_MS;
      attempts = 0;
      clearInterval(timer);
      timer = window.setInterval(() => {
        const left = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
        if (left <= 0) {
          clearInterval(timer);
          error.textContent = "";
          updateButton();
          input.focus();
          return;
        }
        error.textContent = `Trop d'essais. Réessaie dans ${left} s.`;
        updateButton();
      }, 250);
    }

    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
      error.textContent = "";
      updateButton();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (Date.now() < blockedUntil || !/^\d{6}$/.test(input.value)) return;

      submit.dataset.checking = "1";
      submit.textContent = "Vérification…";
      error.textContent = "";
      updateButton();

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "text/plain;charset=UTF-8", accept: "application/json" },
          body: JSON.stringify({ code: input.value })
        });
        const data = await response.json();

        if (data && data.valid === true) {
          saveUnlocked();
          clearInterval(timer);
          overlay.remove();
          document.documentElement.style.overflow = previousOverflow;
          return;
        }

        attempts += 1;
        input.value = "";
        if (response.status === 429 || data?.retryLater === true || attempts >= MAX_ATTEMPTS) {
          setBlocked();
        } else if (data?.unavailable || response.status >= 500) {
          error.textContent = "Service de sécurité indisponible pour le moment.";
        } else {
          error.textContent = "Code incorrect.";
        }
      } catch {
        error.textContent = "Impossible de joindre TikoWiko Security.";
      } finally {
        submit.dataset.checking = "0";
        submit.textContent = "Déverrouiller";
        updateButton();
        input.focus();
      }
    });

    updateButton();
    setTimeout(() => input.focus(), 0);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
