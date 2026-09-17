import * as THREE from "three";
import type { CityPlan } from "./cityPlan";

export type AutoCityStageKind = "road" | "house" | "park" | "parking";

export type AutoCityStage = {
  unlockMoney: number;
  kind: AutoCityStageKind;
  dx: number;
  cz: number;
  level?: number;
  rot?: number;
  label: string;
};

/**
 * Plan d'urbanisation automatique, relatif à la grande avenue principale.
 * Les paliers utilisent l'argent disponible comme indicateur de prospérité :
 * la ville se développe sans retirer cet argent au joueur.
 */
export const AUTO_CITY_STAGES: AutoCityStage[] = [
  { unlockMoney: 220, kind: "road", dx: -1, cz: 0, label: "Rue des Sources" },
  { unlockMoney: 320, kind: "road", dx: -2, cz: 0, label: "Rue des Sources" },
  { unlockMoney: 480, kind: "house", dx: -1, cz: -1, level: 1, label: "Maison des Sources" },
  { unlockMoney: 650, kind: "house", dx: -2, cz: -1, level: 1, label: "Maison des Sources" },
  { unlockMoney: 850, kind: "park", dx: -2, cz: 1, label: "Petit parc des Sources" },

  { unlockMoney: 1050, kind: "road", dx: 1, cz: 3, label: "Avenue du Soleil" },
  { unlockMoney: 1250, kind: "road", dx: 2, cz: 3, label: "Avenue du Soleil" },
  { unlockMoney: 1500, kind: "house", dx: 1, cz: 2, level: 2, label: "Résidence Soleil" },
  { unlockMoney: 1800, kind: "house", dx: 2, cz: 2, level: 2, label: "Résidence Soleil" },
  { unlockMoney: 2150, kind: "parking", dx: 2, cz: 4, label: "Parking du Soleil" },

  { unlockMoney: 2500, kind: "road", dx: -1, cz: 6, label: "Boulevard des Collines" },
  { unlockMoney: 2900, kind: "road", dx: -2, cz: 6, label: "Boulevard des Collines" },
  { unlockMoney: 3400, kind: "house", dx: -1, cz: 5, level: 2, label: "Maisons des Collines" },
  { unlockMoney: 4000, kind: "house", dx: -2, cz: 5, level: 3, label: "Immeuble des Collines" },
  { unlockMoney: 4700, kind: "park", dx: -2, cz: 7, label: "Parc des Collines" },

  { unlockMoney: 5500, kind: "road", dx: 1, cz: 9, label: "Quartier du Lac" },
  { unlockMoney: 6400, kind: "road", dx: 2, cz: 9, label: "Quartier du Lac" },
  { unlockMoney: 7400, kind: "house", dx: 1, cz: 8, level: 3, label: "Résidence du Lac" },
  { unlockMoney: 8500, kind: "house", dx: 2, cz: 8, level: 3, label: "Résidence du Lac" },
  { unlockMoney: 9800, kind: "park", dx: 2, cz: 10, label: "Grand parc du Lac" },
];

type AutoCityRuntimeOptions = {
  scene: THREE.Scene;
  plan: CityPlan;
  tile: number;
  mainCx: number;
  mainCzStart: number;
  getMoney: () => number;
  isDisposed: () => boolean;
  makeHouse: (level: number) => THREE.Object3D;
  renderPlan: () => void;
  renderHouses: () => void;
  renderDecor: () => void;
  onStageStart?: (stage: AutoCityStage) => void;
  onStageComplete?: (stage: AutoCityStage) => void;
};

/**
 * Installe la croissance automatique dans une scène Three.js déjà existante.
 * Le système attend que la route principale existe, puis surveille la richesse
 * et lance un seul chantier à la fois.
 */
export function installAutoCityGrowth(options: AutoCityRuntimeOptions) {
  const {
    scene,
    plan,
    tile,
    mainCx,
    mainCzStart,
    getMoney,
    isDisposed,
    makeHouse,
    renderPlan,
    renderHouses,
    renderDecor,
    onStageStart,
    onStageComplete,
  } = options;

  const constructionGroup = new THREE.Group();
  constructionGroup.name = "TikowikoCityAutoConstruction";
  scene.add(constructionGroup);
  let busy = false;
  let stopped = false;
  let loopTimer = 0;
  let animationFrame = 0;

  const cellFor = (stage: AutoCityStage) => [mainCx + stage.dx, stage.cz] as const;

  const stageResolved = (stage: AutoCityStage) => {
    const [cx, cz] = cellFor(stage);
    const road = plan.has(cx, cz);
    const house = Boolean(plan.house(cx, cz));
    const decor = Boolean(plan.decorAt(cx, cz));
    // Si le joueur a déjà utilisé la case, la ville respecte son choix et passe au palier suivant.
    return road || house || decor;
  };

  const setShadows = (root: THREE.Object3D) => {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  };

  const makeSite = (stage: AutoCityStage, cx: number, cz: number) => {
    const site = new THREE.Group();
    site.position.set(cx * tile, 0.02, cz * tile);
    constructionGroup.add(site);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(tile * 0.9, 0.12, tile * 0.9),
      new THREE.MeshStandardMaterial({ color: 0xc7a56a, roughness: 1 }),
    );
    ground.position.y = 0.06;
    site.add(ground);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe0a326, roughness: 0.72 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xf2c44f, roughness: 0.65 });
    const scaffold = new THREE.Group();
    const poleGeo = new THREE.BoxGeometry(0.12, 4.4, 0.12);
    for (const sx of [-2.2, 2.2]) {
      for (const sz of [-2.2, 2.2]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(sx, 2.2, sz);
        scaffold.add(pole);
      }
    }
    for (const y of [1.1, 2.3, 3.5]) {
      const beamX = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 0.1), beamMat);
      beamX.position.set(0, y, 2.2);
      const beamZ = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 4.6), beamMat);
      beamZ.position.set(2.2, y, 0);
      scaffold.add(beamX, beamZ);
    }
    scaffold.scale.y = 0.04;
    site.add(scaffold);

    const crane = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.5, 0.2), poleMat);
    mast.position.y = 2.75;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 0.16), beamMat);
    arm.position.set(1.9, 5.35, 0);
    crane.add(mast, arm);
    crane.position.set(-2.4, 0, -2.35);
    crane.visible = stage.kind === "house";
    site.add(crane);

    let preview: THREE.Object3D | null = null;
    if (stage.kind === "house") {
      preview = makeHouse(stage.level ?? 1);
      preview.scale.set(1.55, 0.02, 1.55);
      site.add(preview);
    } else if (stage.kind === "road") {
      preview = new THREE.Mesh(
        new THREE.BoxGeometry(tile * 0.96, 0.08, tile * 0.96),
        new THREE.MeshStandardMaterial({ color: 0x697078, roughness: 0.94 }),
      );
      preview.position.y = 0.13;
      preview.scale.x = 0.03;
      site.add(preview);
    } else {
      const color = stage.kind === "park" ? 0x69b85d : 0x646b72;
      preview = new THREE.Mesh(
        new THREE.BoxGeometry(tile * 0.9, 0.1, tile * 0.9),
        new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
      );
      preview.position.y = 0.14;
      preview.scale.set(0.04, 1, 0.04);
      site.add(preview);
    }

    setShadows(site);
    return { site, scaffold, crane, preview };
  };

  const finishStage = (stage: AutoCityStage, cx: number, cz: number) => {
    if (stage.kind === "road") {
      plan.place(cx, cz, "straight", stage.rot ?? 0);
      renderPlan();
    } else if (stage.kind === "house") {
      if (plan.canPlaceHouse(cx, cz)) {
        plan.placeHouse(cx, cz, stage.level ?? 1, stage.rot ?? 0);
        renderHouses();
      }
    } else if (plan.canPlaceDecor(cx, cz)) {
      plan.placeDecor(cx, cz, stage.kind, stage.rot ?? 0);
      renderDecor();
    }
    onStageComplete?.(stage);
  };

  const startStage = (stage: AutoCityStage) => {
    const [cx, cz] = cellFor(stage);
    if (stage.kind === "road" && (plan.house(cx, cz) || plan.decorAt(cx, cz))) return false;
    if (stage.kind === "house" && !plan.canPlaceHouse(cx, cz)) return false;
    if ((stage.kind === "park" || stage.kind === "parking") && !plan.canPlaceDecor(cx, cz)) {
      return false;
    }

    busy = true;
    onStageStart?.(stage);
    const { site, scaffold, crane, preview } = makeSite(stage, cx, cz);
    const started = performance.now();
    const duration = stage.kind === "house" ? 4200 : stage.kind === "road" ? 2400 : 3000;

    const tick = (now: number) => {
      if (stopped || isDisposed()) {
        constructionGroup.remove(site);
        return;
      }
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      scaffold.scale.y = Math.max(0.04, eased);
      crane.rotation.y = now * 0.00065;

      if (preview) {
        if (stage.kind === "house") {
          preview.scale.set(1.55, Math.max(0.02, eased * 1.55), 1.55);
        } else if (stage.kind === "road") {
          preview.scale.x = Math.max(0.03, eased);
        } else {
          preview.scale.set(Math.max(0.04, eased), 1, Math.max(0.04, eased));
        }
      }

      site.position.y = Math.sin(now * 0.008) * 0.015;
      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
        return;
      }

      constructionGroup.remove(site);
      finishStage(stage, cx, cz);
      busy = false;
    };

    animationFrame = requestAnimationFrame(tick);
    return true;
  };

  const advance = () => {
    if (isDisposed() || busy || !plan.has(mainCx, mainCzStart)) return;
    const money = getMoney();
    const next = AUTO_CITY_STAGES.find(
      (stage) => money >= stage.unlockMoney && !stageResolved(stage),
    );
    if (next) startStage(next);
  };

  const loop = () => {
    if (stopped || isDisposed()) return;
    advance();
    loopTimer = window.setTimeout(loop, busy ? 900 : 1800);
  };
  loopTimer = window.setTimeout(loop, 1400);
  return () => {
    stopped = true;
    window.clearTimeout(loopTimer);
    cancelAnimationFrame(animationFrame);
    constructionGroup.clear();
    scene.remove(constructionGroup);
  };
}
