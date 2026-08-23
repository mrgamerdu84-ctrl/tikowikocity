import * as THREE from "three";

/** Réglages spécifiques téléphone/tablette pour TikowikoCity. */
const marker = "__tikowikoMobileCompatInstalled";
const globalState = globalThis as typeof globalThis & Record<string, unknown>;

if (!globalState[marker] && typeof window !== "undefined") {
  globalState[marker] = true;

  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const mobile = coarse || mobileUa;

  if (mobile) {
    document.documentElement.classList.add("tikowiko-mobile");

    const syncViewport = () => {
      const vv = window.visualViewport;
      const height = Math.round(vv?.height ?? window.innerHeight);
      const width = Math.round(vv?.width ?? window.innerWidth);
      document.documentElement.style.setProperty("--tikowiko-vh", `${height}px`);
      document.documentElement.style.setProperty("--tikowiko-vw", `${width}px`);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport, { passive: true });
    window.addEventListener("orientationchange", syncViewport, { passive: true });
    window.visualViewport?.addEventListener("resize", syncViewport, { passive: true });

    /* Sur mobile, 2x/3x de devicePixelRatio coûte énormément en WebGL.
       On garde une image nette tout en plafonnant la charge GPU. */
    const proto = THREE.WebGLRenderer.prototype;
    const originalSetPixelRatio = proto.setPixelRatio;
    proto.setPixelRatio = function mobileSetPixelRatio(value: number) {
      return originalSetPixelRatio.call(this, Math.min(value, 1.25));
    };
  }
}
