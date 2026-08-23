import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Lisse les événements pointermove reçus par le canvas Three.js.
 * Les téléphones peuvent envoyer beaucoup plus de mouvements que le rendu 3D
 * ne peut en traiter. Le jeu conserve le tracé continu (il remplit les cases
 * intermédiaires), mais ne traite qu'un mouvement utile par frame.
 *
 * Ce module installe aussi un petit pavé caméra tactile pendant le mode
 * construction. Un doigt peut rester sur une flèche/zoom tandis qu'un autre
 * doigt continue à poser des objets sur la carte.
 */
const marker = "__tikowikoBuildSmoothInstalled";
const cameraMarker = "__tikowikoBuildCameraPadInstalled";
const globalState = globalThis as typeof globalThis & Record<string, unknown>;

if (
  !globalState[marker] &&
  typeof window !== "undefined" &&
  typeof EventTarget !== "undefined" &&
  typeof HTMLCanvasElement !== "undefined"
) {
  globalState[marker] = true;

  type Listener = EventListenerOrEventListenerObject;
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const wrappedByTarget = new WeakMap<EventTarget, Map<Listener, EventListener>>();
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const minInterval = coarsePointer ? 1000 / 30 : 1000 / 60;

  EventTarget.prototype.addEventListener = function patchedAddEventListener(
    type: string,
    listener: Listener | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (type !== "pointermove" || !(this instanceof HTMLCanvasElement) || !listener) {
      return originalAdd.call(this, type, listener as EventListener | null, options);
    }

    let targetMap = wrappedByTarget.get(this);
    if (!targetMap) {
      targetMap = new Map();
      wrappedByTarget.set(this, targetMap);
    }
    const existing = targetMap.get(listener);
    if (existing) return originalAdd.call(this, type, existing, options);

    const target = this;
    let queued = false;
    let lastEvent: Event | null = null;
    let lastTime = 0;
    let timer = 0;

    const deliver = (time: number) => {
      const remaining = minInterval - (time - lastTime);
      if (remaining > 1) {
        timer = window.setTimeout(() => {
          timer = 0;
          requestAnimationFrame(deliver);
        }, remaining);
        return;
      }

      queued = false;
      lastTime = time;
      const event = lastEvent;
      lastEvent = null;
      if (!event) return;

      if (typeof listener === "function") listener.call(target, event);
      else listener.handleEvent(event);
    };

    const wrapped: EventListener = (event) => {
      lastEvent = event;
      if (queued) return;
      queued = true;
      if (timer) window.clearTimeout(timer);
      requestAnimationFrame(deliver);
    };

    targetMap.set(listener, wrapped);
    return originalAdd.call(this, type, wrapped, options);
  } as typeof EventTarget.prototype.addEventListener;

  EventTarget.prototype.removeEventListener = function patchedRemoveEventListener(
    type: string,
    listener: Listener | null,
    options?: boolean | EventListenerOptions,
  ) {
    if (type === "pointermove" && listener) {
      const targetMap = wrappedByTarget.get(this);
      const wrapped = targetMap?.get(listener);
      if (wrapped) {
        targetMap?.delete(listener);
        return originalRemove.call(this, type, wrapped, options);
      }
    }
    return originalRemove.call(this, type, listener as EventListener | null, options);
  } as typeof EventTarget.prototype.removeEventListener;
}

if (!globalState[cameraMarker] && typeof window !== "undefined" && typeof document !== "undefined") {
  globalState[cameraMarker] = true;

  type CameraAction =
    | "left"
    | "right"
    | "forward"
    | "back"
    | "zoomIn"
    | "zoomOut"
    | "rotateLeft"
    | "rotateRight"
    | "reset";

  let latestControls: OrbitControls | null = null;
  let homePosition: THREE.Vector3 | null = null;
  let homeTarget: THREE.Vector3 | null = null;
  let holdTimer: number | null = null;
  const cameraCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;

  /* OrbitControls est créé dans CarWashScene. En capturant son premier update,
     on obtient la caméra et la cible sans coupler ce module au gros composant 3D. */
  const proto = OrbitControls.prototype as OrbitControls & {
    update: (deltaTime?: number) => boolean;
  };
  const originalUpdate = proto.update;
  proto.update = function patchedOrbitUpdate(this: OrbitControls, deltaTime?: number) {
    latestControls = this;
    if (!homePosition || !homeTarget) {
      homePosition = this.object.position.clone();
      homeTarget = this.target.clone();
    }
    return originalUpdate.call(this, deltaTime);
  };

  const stopHold = () => {
    if (holdTimer !== null) {
      window.clearInterval(holdTimer);
      holdTimer = null;
    }
  };

  const moveCamera = (action: CameraAction) => {
    const controls = latestControls;
    if (!controls) return;
    const camera = controls.object;

    if (action === "reset") {
      if (homePosition && homeTarget) {
        camera.position.copy(homePosition);
        controls.target.copy(homeTarget);
        controls.update();
      }
      return;
    }

    const target = controls.target;
    const offset = camera.position.clone().sub(target);
    const distance = Math.max(offset.length(), 1);
    const panStep = THREE.MathUtils.clamp(distance * 0.055, 1.2, 7.5);
    const flatForward = new THREE.Vector3(-offset.x, 0, -offset.z);
    if (flatForward.lengthSq() < 0.0001) flatForward.set(0, 0, -1);
    flatForward.normalize();
    const right = new THREE.Vector3()
      .crossVectors(flatForward, new THREE.Vector3(0, 1, 0))
      .normalize();
    const move = new THREE.Vector3();

    if (action === "forward") move.copy(flatForward).multiplyScalar(panStep);
    else if (action === "back") move.copy(flatForward).multiplyScalar(-panStep);
    else if (action === "left") move.copy(right).multiplyScalar(-panStep);
    else if (action === "right") move.copy(right).multiplyScalar(panStep);

    if (move.lengthSq() > 0) {
      camera.position.add(move);
      target.add(move);
    } else if (action === "zoomIn" || action === "zoomOut") {
      const factor = action === "zoomIn" ? 0.88 : 1.14;
      const minDistance = Number.isFinite(controls.minDistance) ? controls.minDistance : 6;
      const maxDistance = Number.isFinite(controls.maxDistance) ? controls.maxDistance : 160;
      const nextDistance = THREE.MathUtils.clamp(distance * factor, minDistance, maxDistance);
      offset.setLength(nextDistance);
      camera.position.copy(target).add(offset);
    } else if (action === "rotateLeft" || action === "rotateRight") {
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += action === "rotateLeft" ? -0.12 : 0.12;
      offset.setFromSpherical(spherical);
      camera.position.copy(target).add(offset);
    }

    controls.update();
  };

  const startHold = (action: CameraAction) => {
    stopHold();
    moveCamera(action);
    holdTimer = window.setInterval(() => moveCamera(action), 70);
  };

  const buttonStyle = (button: HTMLButtonElement) => {
    button.style.width = "38px";
    button.style.height = "38px";
    button.style.border = "0";
    button.style.borderRadius = "11px";
    button.style.background = "rgba(15, 23, 42, 0.10)";
    button.style.color = "#0f172a";
    button.style.fontSize = "18px";
    button.style.fontWeight = "900";
    button.style.touchAction = "none";
    button.style.userSelect = "none";
    button.style.webkitUserSelect = "none";
  };

  const makeHoldButton = (label: string, title: string, action: CameraAction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", title);
    buttonStyle(button);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Certains WebView Android ne prennent pas en charge la capture.
      }
      startHold(action);
    });
    for (const eventName of ["pointerup", "pointercancel", "pointerleave"] as const) {
      button.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        stopHold();
      });
    }
    return button;
  };

  const makeTapButton = (label: string, title: string, onTap: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", title);
    buttonStyle(button);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTap();
    });
    return button;
  };

  const mountPad = () => {
    if (document.getElementById("tikowiko-build-camera-pad")) return;

    const pad = document.createElement("div");
    pad.id = "tikowiko-build-camera-pad";
    pad.setAttribute("aria-label", "Commandes caméra construction");
    pad.style.position = "fixed";
    pad.style.right = "8px";
    pad.style.top = "50%";
    pad.style.transform = "translateY(-50%)";
    pad.style.zIndex = "70";
    pad.style.display = "none";
    pad.style.width = "124px";
    pad.style.padding = "6px";
    pad.style.borderRadius = "18px";
    pad.style.background = "rgba(255,255,255,0.90)";
    pad.style.boxShadow = "0 8px 26px rgba(6,58,94,0.24)";
    pad.style.backdropFilter = "blur(10px)";
    pad.style.border = "1px solid rgba(15,23,42,0.10)";
    pad.style.touchAction = "none";

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(3, 38px)";
    grid.style.gap = "3px";

    const blank = () => document.createElement("span");
    grid.append(
      blank(),
      makeHoldButton("▲", "Avancer sur la carte", "forward"),
      blank(),
      makeHoldButton("◀", "Déplacer la vue à gauche", "left"),
      makeTapButton("🎯", "Recentrer la caméra", () => moveCamera("reset")),
      makeHoldButton("▶", "Déplacer la vue à droite", "right"),
      blank(),
      makeHoldButton("▼", "Reculer sur la carte", "back"),
      blank(),
    );
    pad.appendChild(grid);

    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "repeat(4, 1fr)";
    row.style.gap = "3px";
    row.style.marginTop = "4px";
    const zoomIn = makeHoldButton("＋", "Zoomer", "zoomIn");
    const zoomOut = makeHoldButton("−", "Dézoomer", "zoomOut");
    const rotLeft = makeHoldButton("↺", "Tourner la caméra à gauche", "rotateLeft");
    const rotRight = makeHoldButton("↻", "Tourner la caméra à droite", "rotateRight");
    for (const button of [zoomIn, zoomOut, rotLeft, rotRight]) {
      button.style.width = "26px";
      button.style.height = "34px";
      button.style.fontSize = "16px";
    }
    row.append(zoomIn, zoomOut, rotLeft, rotRight);
    pad.appendChild(row);

    const fullscreen = makeTapButton("⛶ Plein écran", "Passer le jeu en plein écran", () => {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.().catch(() => undefined);
      } else {
        void document.exitFullscreen?.().catch(() => undefined);
      }
    });
    fullscreen.style.width = "100%";
    fullscreen.style.height = "34px";
    fullscreen.style.marginTop = "4px";
    fullscreen.style.fontSize = "11px";
    fullscreen.style.background = "#0f172a";
    fullscreen.style.color = "white";
    pad.appendChild(fullscreen);

    document.body.appendChild(pad);

    const updateVisibility = () => {
      const buildActive = [...document.querySelectorAll("button")].some((button) =>
        button.textContent?.includes("Terminer"),
      );
      const mobileLike =
        cameraCoarsePointer ||
        window.innerWidth <= 1024 ||
        window.matchMedia?.("(hover: none)").matches;
      pad.style.display = buildActive && mobileLike ? "block" : "none";
      if (!buildActive) stopHold();
    };

    const observer = new MutationObserver(updateVisibility);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", updateVisibility, { passive: true });
    document.addEventListener("fullscreenchange", updateVisibility);
    updateVisibility();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPad, { once: true });
  } else {
    mountPad();
  }
}
