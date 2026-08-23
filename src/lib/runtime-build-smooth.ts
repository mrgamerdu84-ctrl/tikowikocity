/**
 * Lisse les événements pointermove reçus par le canvas Three.js.
 * Les téléphones peuvent envoyer beaucoup plus de mouvements que le rendu 3D
 * ne peut en traiter. Le jeu conserve le tracé continu (il remplit les cases
 * intermédiaires), mais ne traite qu'un mouvement utile par frame.
 */
const marker = "__tikowikoBuildSmoothInstalled";
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
