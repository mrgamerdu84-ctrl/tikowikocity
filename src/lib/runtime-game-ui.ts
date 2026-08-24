import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const GLOBAL_KEY = "__tikowikoUnifiedGameUiV1";
const g = globalThis as typeof globalThis & Record<string, unknown>;

if (!g[GLOBAL_KEY] && typeof window !== "undefined" && typeof document !== "undefined") {
  g[GLOBAL_KEY] = true;

  let controls: OrbitControls | null = null;
  let buildActive = false;
  let cameraMode = false;

  // CarWashScene crée OrbitControls après ce module. On garde une référence
  // à l'instance réelle sans modifier la logique 3D du jeu.
  const proto = OrbitControls.prototype as unknown as {
    update: (deltaTime?: number) => boolean;
  };
  const originalUpdate = proto.update;
  proto.update = function patchedUpdate(this: OrbitControls, deltaTime?: number) {
    controls = this;
    return originalUpdate.call(this, deltaTime);
  };

  const style = document.createElement("style");
  style.textContent = `
    .tikowiko-legacy-hidden{display:none!important}
    #tikowiko-unified-ui button{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "tikowiko-unified-ui";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.pointerEvents = "none";
  root.style.zIndex = "75";
  document.body.appendChild(root);

  const top = document.createElement("div");
  Object.assign(top.style, {
    position: "absolute",
    left: "8px",
    right: "8px",
    top: "8px",
    minHeight: "46px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 9px",
    borderRadius: "17px",
    background: "rgba(255,255,255,.93)",
    color: "#0f172a",
    boxShadow: "0 7px 24px rgba(15,23,42,.18)",
    backdropFilter: "blur(12px)",
    pointerEvents: "auto",
    border: "1px solid rgba(15,23,42,.08)",
  });
  root.appendChild(top);

  const titleBox = document.createElement("div");
  titleBox.style.minWidth = "0";
  titleBox.style.flex = "1";
  const title = document.createElement("div");
  title.textContent = "🏙️ TikowikoCity";
  title.style.fontSize = "12px";
  title.style.fontWeight = "900";
  const stats = document.createElement("div");
  stats.textContent = "💰 — € · 👥 — · 🏠 —";
  stats.style.fontSize = "11px";
  stats.style.fontWeight = "700";
  stats.style.opacity = ".72";
  stats.style.whiteSpace = "nowrap";
  titleBox.append(title, stats);
  top.appendChild(titleBox);

  const makeButton = (label: string, dark = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    Object.assign(b.style, {
      border: "0",
      borderRadius: "12px",
      padding: "9px 11px",
      fontSize: "12px",
      fontWeight: "900",
      background: dark ? "#0f172a" : "#e2e8f0",
      color: dark ? "white" : "#0f172a",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    return b;
  };

  const menuButton = makeButton("☰ Tableau", true);
  top.appendChild(menuButton);

  const dock = document.createElement("div");
  Object.assign(dock.style, {
    position: "absolute",
    left: "50%",
    bottom: "max(env(safe-area-inset-bottom), 8px)",
    transform: "translateX(-50%)",
    display: "flex",
    gap: "5px",
    padding: "6px",
    borderRadius: "17px",
    background: "rgba(255,255,255,.95)",
    boxShadow: "0 7px 24px rgba(15,23,42,.2)",
    border: "1px solid rgba(15,23,42,.08)",
    pointerEvents: "auto",
  });
  root.appendChild(dock);

  const manageButton = makeButton("📊 Gestion");
  const buildButton = makeButton("🏗️ Construire", true);
  buildButton.style.background = "#0ea5e9";
  const fullButton = makeButton("⛶");
  dock.append(manageButton, buildButton, fullButton);

  const modal = document.createElement("div");
  Object.assign(modal.style, {
    position: "absolute",
    inset: "0",
    display: "none",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "10px",
    background: "rgba(2,6,23,.48)",
    backdropFilter: "blur(5px)",
    pointerEvents: "auto",
  });
  root.appendChild(modal);

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: "min(100%, 560px)",
    maxHeight: "91vh",
    overflow: "auto",
    borderRadius: "26px",
    padding: "14px",
    background: "white",
    color: "#0f172a",
    boxShadow: "0 18px 55px rgba(2,6,23,.35)",
  });
  modal.appendChild(panel);

  const cameraBar = document.createElement("div");
  Object.assign(cameraBar.style, {
    position: "absolute",
    left: "8px",
    right: "8px",
    top: "58px",
    display: "none",
    gap: "7px",
    alignItems: "center",
    padding: "6px",
    borderRadius: "16px",
    background: "rgba(255,255,255,.94)",
    boxShadow: "0 7px 24px rgba(15,23,42,.2)",
    border: "1px solid rgba(15,23,42,.08)",
    pointerEvents: "auto",
  });
  root.appendChild(cameraBar);
  const cameraToggle = makeButton("✋ Caméra", true);
  cameraToggle.style.flex = "1";
  const cameraHint = document.createElement("span");
  cameraHint.textContent = "Déplace et zoome sans quitter la construction";
  cameraHint.style.fontSize = "10px";
  cameraHint.style.fontWeight = "700";
  cameraHint.style.opacity = ".65";
  cameraHint.style.flex = "1";
  cameraBar.append(cameraToggle, cameraHint);

  // Transparent only in camera mode: it catches gestures before the build canvas,
  // so no road/house is placed by accident.
  const cameraSurface = document.createElement("div");
  Object.assign(cameraSurface.style, {
    position: "absolute",
    inset: "0 0 148px 0",
    display: "none",
    pointerEvents: "auto",
    touchAction: "none",
    background: "transparent",
    zIndex: "-1",
  });
  root.appendChild(cameraSurface);

  const allButtons = () => [...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !root.contains(b));
  const byText = (needle: string) => allButtons().find((b) => (b.textContent ?? "").includes(needle));
  const clickText = (...needles: string[]) => {
    for (const needle of needles) {
      const b = byText(needle);
      if (b) {
        b.click();
        return true;
      }
    }
    return false;
  };

  const hideLegacy = () => {
    const hidePanelFor = (needle: string) => {
      const b = byText(needle);
      const fixed = b?.closest<HTMLElement>("div.fixed");
      if (fixed) fixed.classList.add("tikowiko-legacy-hidden");
    };
    hidePanelFor("Améliorations");
    hidePanelFor("⚙️ Machines");
    hidePanelFor("Vue cinéma");
    hidePanelFor("Vue libre");
    const build = byText("🏗️ Construire");
    build?.closest<HTMLElement>("div.fixed")?.classList.add("tikowiko-legacy-hidden");
    const rentals = byText("Locations");
    if (rentals) rentals.classList.add("tikowiko-legacy-hidden");
  };

  const readLegacyStats = () => {
    const cards = [...document.querySelectorAll<HTMLElement>("div.fixed")];
    const card = cards.find((el) => (el.textContent ?? "").includes("TikowikoCity"));
    const text = card?.textContent ?? document.body.textContent ?? "";
    const money = text.match(/([\d\s .,]+)\s*€/);
    const residents = text.match(/(\d+)\s*habitant/);
    const houses = text.match(/(\d+)\s*🏠/) ?? text.match(/🏠\s*(\d+)/);
    const washes = text.match(/(\d+)\s*lavage/);
    stats.textContent = `💰 ${money?.[1]?.trim() ?? "—"} € · 👥 ${residents?.[1] ?? "—"} · 🏠 ${houses?.[1] ?? "—"}`;
    return { money: money?.[1]?.trim() ?? "—", residents: residents?.[1] ?? "—", houses: houses?.[1] ?? "—", washes: washes?.[1] ?? "—" };
  };

  const cardButton = (label: string, sub: string, action: () => void, color: string) => {
    const b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      width: "100%",
      minHeight: "76px",
      border: "0",
      borderRadius: "17px",
      padding: "11px",
      textAlign: "left",
      background: color,
      color: "white",
      fontWeight: "900",
      fontSize: "13px",
    });
    const strong = document.createElement("div");
    strong.textContent = label;
    const small = document.createElement("div");
    small.textContent = sub;
    small.style.fontSize = "10px";
    small.style.marginTop = "4px";
    small.style.opacity = ".86";
    small.style.fontWeight = "700";
    b.append(strong, small);
    b.addEventListener("click", action);
    return b;
  };

  const closeModal = () => { modal.style.display = "none"; };
  const openModal = () => {
    const current = readLegacyStats();
    panel.replaceChildren();

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "8px";
    const h = document.createElement("div");
    h.innerHTML = `<div style="font-size:18px;font-weight:950">📊 Tableau de bord</div><div style="font-size:10px;opacity:.6;font-weight:700">Ville · argent · car wash · construction</div>`;
    const x = makeButton("✕");
    x.style.marginLeft = "auto";
    x.addEventListener("click", closeModal);
    head.append(h, x);
    panel.appendChild(head);

    const summary = document.createElement("div");
    Object.assign(summary.style, { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "7px", marginTop: "12px" });
    for (const [label, value] of [["💰 Solde", `${current.money} €`], ["🫧 Lavages", current.washes], ["👥 Habitants", current.residents], ["🏠 Maisons", current.houses]]) {
      const c = document.createElement("div");
      c.innerHTML = `<div style="font-size:10px;font-weight:800;opacity:.55">${label}</div><div style="font-size:17px;font-weight:950;margin-top:2px">${value}</div>`;
      Object.assign(c.style, { background: "#f1f5f9", borderRadius: "15px", padding: "10px" });
      summary.appendChild(c);
    }
    panel.appendChild(summary);

    const grid = document.createElement("div");
    Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "7px", marginTop: "9px" });
    grid.append(
      cardButton("🏗️ Construction", "Routes, maisons, parcs, éclairage", () => { closeModal(); clickText("🏗️ Construire"); }, "#0ea5e9"),
      cardButton("🛠️ Améliorations", "Station, clientèle et équipe", () => { closeModal(); clickText("Améliorations"); }, "#d97706"),
      cardButton("🏘️ Locations", "Loyers, impôts et besoins", () => { closeModal(); clickText("Locations"); }, "#7c3aed"),
      cardButton("🧾 Argent & historique", "Toutes les entrées et dépenses", () => { closeModal(); clickText("Historique"); }, "#059669"),
    );
    panel.appendChild(grid);

    const machines = document.createElement("div");
    Object.assign(machines.style, { marginTop: "9px", padding: "10px", borderRadius: "17px", background: "#f8fafc", border: "1px solid #e2e8f0" });
    const mh = document.createElement("div");
    mh.textContent = "⚙️ Commandes du car wash";
    mh.style.fontSize = "12px";
    mh.style.fontWeight = "900";
    machines.appendChild(mh);
    const machineGrid = document.createElement("div");
    Object.assign(machineGrid.style, { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "6px", marginTop: "7px" });
    for (const [label, needle] of [["🛤️ Tapis", "Tapis"], ["🌀 Rouleaux", "Rouleaux"], ["🧽 Brosses", "Brosses"], ["🚦 Trafic", "Trafic"]]) {
      const b = makeButton(label);
      b.addEventListener("click", () => clickText(needle));
      machineGrid.appendChild(b);
    }
    machines.appendChild(machineGrid);
    panel.appendChild(machines);

    const viewRow = document.createElement("div");
    Object.assign(viewRow.style, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginTop: "9px" });
    const cinema = makeButton("🎥 Vue cinéma", true);
    cinema.addEventListener("click", () => { clickText("Vue cinéma", "Vue libre"); closeModal(); });
    const fullscreen = makeButton("⛶ Plein écran");
    fullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      else void document.exitFullscreen?.().catch(() => undefined);
    });
    viewRow.append(cinema, fullscreen);
    panel.appendChild(viewRow);

    const safe = document.createElement("div");
    safe.textContent = "✅ Sauvegarde locale automatique · APK autonome : le jeu ne dépend plus de la publication Lovable pour démarrer.";
    Object.assign(safe.style, { marginTop: "9px", padding: "9px", borderRadius: "14px", background: "#ecfdf5", color: "#065f46", fontSize: "10px", fontWeight: "800" });
    panel.appendChild(safe);

    modal.style.display = "flex";
  };

  menuButton.addEventListener("click", openModal);
  manageButton.addEventListener("click", openModal);
  buildButton.addEventListener("click", () => clickText("🏗️ Construire"));
  fullButton.addEventListener("click", () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    else void document.exitFullscreen?.().catch(() => undefined);
  });
  modal.addEventListener("pointerdown", (e) => { if (e.target === modal) closeModal(); });

  const pointers = new Map<number, { x: number; y: number }>();
  let lastDist = 0;
  let lastMid = { x: 0, y: 0 };

  const applyOneFinger = (dx: number, dy: number) => {
    if (!controls) return;
    const camera = controls.object;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= dx * 0.006;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + dy * 0.005, 0.25, Math.PI * 0.49);
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  };

  const applyTwoFinger = (dist: number, mid: { x: number; y: number }) => {
    if (!controls || !lastDist) return;
    const camera = controls.object;
    const target = controls.target;
    const offset = camera.position.clone().sub(target);
    const currentDistance = Math.max(offset.length(), 1);
    const minD = Number.isFinite(controls.minDistance) ? controls.minDistance : 6;
    const maxD = Number.isFinite(controls.maxDistance) ? controls.maxDistance : 160;
    const nextDistance = THREE.MathUtils.clamp(currentDistance * (lastDist / Math.max(dist, 1)), minD, maxD);
    offset.setLength(nextDistance);
    camera.position.copy(target).add(offset);

    const dx = mid.x - lastMid.x;
    const dy = mid.y - lastMid.y;
    const scale = nextDistance * 0.0023;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
    const forward = target.clone().sub(camera.position).setY(0);
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    forward.normalize();
    const move = right.multiplyScalar(-dx * scale).add(forward.multiplyScalar(dy * scale));
    camera.position.add(move);
    target.add(move);
    controls.update();
  };

  cameraSurface.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cameraSurface.setPointerCapture(e.pointerId); } catch { /* Android old WebView */ }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      lastDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      lastMid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
    }
  });
  cameraSurface.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      applyOneFinger(e.clientX - prev.x, e.clientY - prev.y);
      return;
    }
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
      applyTwoFinger(dist, mid);
      lastDist = dist;
      lastMid = mid;
    }
  });
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastDist = 0;
  };
  cameraSurface.addEventListener("pointerup", release);
  cameraSurface.addEventListener("pointercancel", release);

  const setCameraMode = (on: boolean) => {
    cameraMode = on;
    pointers.clear();
    lastDist = 0;
    cameraSurface.style.display = on && buildActive ? "block" : "none";
    cameraToggle.textContent = on ? "🧱 Poser" : "✋ Caméra";
    cameraHint.textContent = on ? "1 doigt = tourner · 2 doigts = déplacer/zoomer" : "Déplace et zoome sans quitter la construction";
  };
  cameraToggle.addEventListener("click", () => setCameraMode(!cameraMode));

  const refresh = () => {
    hideLegacy();
    readLegacyStats();
    buildActive = !!byText("Terminer");
    top.style.display = buildActive ? "none" : "flex";
    dock.style.display = buildActive ? "none" : "flex";
    cameraBar.style.display = buildActive ? "flex" : "none";
    if (!buildActive && cameraMode) setCameraMode(false);
    cameraSurface.style.display = buildActive && cameraMode ? "block" : "none";
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  window.addEventListener("resize", refresh, { passive: true });
  window.setInterval(refresh, 1200);
  refresh();
}
