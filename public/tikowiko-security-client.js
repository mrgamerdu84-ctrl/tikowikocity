(() => {
  // Compatibility cleanup after TikoWiko Security removal.
  // Old published builds may still load this URL from cache or stale HTML.
  try {
    sessionStorage.setItem("tikowiko-security-unlocked", "1");
  } catch {}

  const removeLegacyGate = () => {
    document.getElementById("tikowiko-security-gate")?.remove();
    document.documentElement.style.overflow = "";
    document.body && (document.body.style.overflow = "");
  };

  removeLegacyGate();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removeLegacyGate, { once: true });
  }
})();
