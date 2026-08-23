import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveToDrive, loadFromDrive } from "@/lib/drive.functions";
import { avatarSrc, usePlayer } from "@/lib/player";


const SAVE_VERSION = 1;


import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import modelsAsset from "@/assets/car-wash-models.json.asset.json";

import tunnelAsset from "@/assets/tunnel.glb.asset.json";
import kenneyPackAsset from "@/assets/kenney-pack.glb.asset.json";
import { CityPlan, type SerializedPlan } from "@/game/cityPlan";
import {
  TILE,
  DIR_VEC,
  opposite,
  axisOf,
  rightOf,
  parseKey,
  worldToCell,
  type Dir,
} from "@/game/grid";
import { TOOL_LABEL, type BuildTool, type RoadHint } from "@/game/catalog";
import {
  UPGRADES,
  DEFAULT_UPGRADES,
  MAX_LEVEL,
  capacityOf,
  beltFactor,
  washInterval,
  rollReward,
  upgradeCost,
  sanitizeUpgrades,
  type UpgradeKey,
  type UpgradeLevels,
} from "@/game/upgrades";


/* Modèles issus des kits Kenney (car-kit, city-kit-roads, building-kit),
   regroupés dans un seul GLB optimisé. */
const KIT_CARS = [
  "sedan",
  "sedan-sports",
  "suv",
  "suv-luxury",
  "taxi",
  "van",
  "delivery",
  "hatchback-sports",
  "police",
  "truck",
  "ambulance",
] as const;




const MESSAGES = [
  "Préparation du savon...",
  "Déroulement du tapis...",
  "Réglage des brosses...",
  "Ouverture du portail...",
];

const MODEL_KEYS = [
  "sedan",
  "taxi",
  "roadStraight",
  "roadEnd",
  "tunnel",
  "hFloor",
  "hWallWindow",
  "hRoof",
] as const;

const ROAD_Y = 0;
const PATH_START = -13;
const PATH_END = 13;
const WASH_ZONE: [number, number] = [-1.5, 5.5];
/* Le car wash a sa propre parcelle en périphérie sud de la ville,
   reliée à la grille par une voie d'accès dédiée. */
const WASH_SITE_Z = -42;
const WASH_ACCESS_X = 6;
const DIRT_COLOR = new THREE.Color(0x8a7355);

function b64ToArrayBuffer(b64: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

export default function CarWashScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { player } = usePlayer();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(MESSAGES[0]!);
  const cinemaRef = useRef<() => void>(() => {});
  const [cinema, setCinema] = useState(false);
  const [machines, setMachines] = useState({
    belt: true,
    rollers: true,
    brushes: true,
    traffic: true,
  });
  const machinesRef = useRef(machines);

  /* ----- Économie : chaque lavage terminé rapporte de l'argent.
     Les routes restent gratuites (aucun coût de construction). ----- */
  const [economy, setEconomy] = useState({ money: 0, washes: 0 });
  const economyRef = useRef(economy);
  const [gain, setGain] = useState<{ id: number; amount: number } | null>(null);
  const registerWashRef = useRef<(amount: number) => void>(() => {});
  registerWashRef.current = (amount: number) => {
    setEconomy((prev) => {
      const next = { money: prev.money + amount, washes: prev.washes + 1 };
      economyRef.current = next;
      return next;
    });
    setGain({ id: Date.now() + Math.random(), amount });
  };
  useEffect(() => {
    if (!gain) return;
    const id = window.setTimeout(() => setGain(null), 1600);
    return () => window.clearTimeout(id);
  }, [gain]);

  /* ----- Boutique d'améliorations ----- */
  const [upgrades, setUpgrades] = useState<UpgradeLevels>(DEFAULT_UPGRADES);
  const upgradesRef = useRef(upgrades);
  const [shopOpen, setShopOpen] = useState(false);

  const buyUpgrade = (key: UpgradeKey) => {
    const level = upgradesRef.current[key];
    if (level >= MAX_LEVEL) return;
    const cost = upgradeCost(key, level);
    if (economyRef.current.money < cost) {
      toast.error(`Il manque ${(cost - economyRef.current.money).toLocaleString("fr-FR")} €`);
      return;
    }
    const nextEco = { ...economyRef.current, money: economyRef.current.money - cost };
    economyRef.current = nextEco;
    setEconomy(nextEco);
    const nextUp = { ...upgradesRef.current, [key]: level + 1 };
    upgradesRef.current = nextUp;
    setUpgrades(nextUp);
    const def = UPGRADES.find((u) => u.key === key)!;
    toast.success(`${def.icon} ${def.label} niveau ${level + 1}`, {
      description: def.effect(level + 1),
    });
  };


  const toggleMachine = (key: keyof typeof machines) => {
    setMachines((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      machinesRef.current = next;
      return next;
    });
  };

  /* ----- Mode construction (pose de routes / mobilier par le joueur) ----- */
  const [buildMode, setBuildMode] = useState(false);
  const [tool, setTool] = useState<BuildTool>("straight");
  const [rot, setRot] = useState(0);
  const buildRef = useRef(false);
  const toolRef = useRef<BuildTool>("straight");
  const rotRef = useRef(0);
  const buildApplyRef = useRef<(on: boolean) => void>(() => {});
  const planIoRef = useRef<{
    save: () => SerializedPlan;
    load: (data: SerializedPlan) => void;
  }>({ save: () => [], load: () => {} });

  const chooseTool = (t: BuildTool) => {
    toolRef.current = t;
    setTool(t);
  };
  const toggleBuild = () => {
    setBuildMode((prev) => {
      const next = !prev;
      buildRef.current = next;
      buildApplyRef.current(next);
      return next;
    });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "r" || !buildRef.current) return;
      setRot((r) => {
        const next = (r + 1) % 4;
        rotRef.current = next;
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);



  const [driveState, setDriveState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [driveMenuOpen, setDriveMenuOpen] = useState(false);
  const saveFn = useServerFn(saveToDrive);
  const loadFn = useServerFn(loadFromDrive);

  useEffect(() => {
    if (!driveMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-drive-menu]")) setDriveMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [driveMenuOpen]);
  const cinemaStateRef = useRef(cinema);
  cinemaStateRef.current = cinema;

  const handleSaveToDrive = async () => {
    setDriveState("saving");
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const res = await saveFn({
        data: {
          fileName: `tikowikocarwash-${stamp}.json`,
          payload: {
            version: SAVE_VERSION,
            app: "TikowikoCarWash",
            savedAt: new Date().toISOString(),
            // Extensible: new progression fields can be added here without
            // breaking older saves (loader applies only known keys).
            state: {
              machines: machinesRef.current,
              cinema: cinemaStateRef.current,
              city: planIoRef.current.save(),
              economy: economyRef.current,
              upgrades: upgradesRef.current,


            },
          },
        },
      });
      setDriveState("done");
      setDriveMenuOpen(false);
      toast.success("Sauvegardé sur Google Drive", {
        description: res.name,
        ...(res.webViewLink
          ? { action: { label: "Ouvrir", onClick: () => window.open(res.webViewLink, "_blank") } }
          : {}),
      });
      window.setTimeout(() => setDriveState("idle"), 4000);
    } catch (err) {
      console.error(err);
      setDriveState("error");
      toast.error("Échec de la sauvegarde sur Drive");
    }
  };

  const handleLoadFromDrive = async () => {
    setLoadState("loading");
    try {
      const res = await loadFn({ data: undefined });
      if (!res.found) {
        setLoadState("idle");
        toast.info("Aucune sauvegarde trouvée dans le dossier TikowikoCarWash.");
        return;
      }
      const state = JSON.parse(res.stateJson || "{}") as {
        machines?: Partial<typeof machines>;
        cinema?: unknown;
        city?: SerializedPlan;
        economy?: { money?: unknown; washes?: unknown };
      };
      if (state.machines && typeof state.machines === "object") {
        setMachines((prev) => {
          const next = { ...prev };
          (Object.keys(prev) as Array<keyof typeof prev>).forEach((k) => {
            const v = state.machines?.[k];
            if (typeof v === "boolean") next[k] = v;
          });
          machinesRef.current = next;
          return next;
        });
      }
      if (Array.isArray(state.city)) planIoRef.current.load(state.city);
      if (state.economy && typeof state.economy === "object") {
        const money = state.economy.money;
        const washes = state.economy.washes;
        const next = {
          money: typeof money === "number" && Number.isFinite(money) ? money : 0,
          washes: typeof washes === "number" && Number.isFinite(washes) ? washes : 0,
        };
        economyRef.current = next;
        setEconomy(next);
      }
      if (typeof state.cinema === "boolean" && state.cinema !== cinemaStateRef.current) {
        cinemaRef.current();
      }

      setLoadState("done");
      setDriveMenuOpen(false);
      toast.success("Progression restaurée depuis Drive", { description: res.fileName });
      window.setTimeout(() => setLoadState("idle"), 4000);
    } catch (err) {
      console.error(err);
      setLoadState("error");
      toast.error(err instanceof Error ? err.message : "Échec du chargement depuis Drive");
    }
  };




  useEffect(() => {
    let mi = 0;
    const timer = window.setInterval(() => {
      mi = (mi + 1) % MESSAGES.length;
      setMessage(MESSAGES[mi]!);
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let disposed = false;
    let frame = 0;
    let waterSurface: THREE.Mesh | null = null;
    

    /* GLTFLoader décode les textures via ImageBitmapLoader (fetch), ce que
       l'iframe de prévisualisation peut bloquer : on force le décodage <img>. */
    (window as unknown as { createImageBitmap?: unknown }).createImageBitmap = undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd9eefb, 260, 1100);

    /* Ciel dégradé (canvas) pour sortir du fond plat */
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 4;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext("2d")!;
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#3fa9e8");
    grad.addColorStop(0.55, "#9fd8f5");
    grad.addColorStop(1, "#e9f6ff");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(760, 32, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
    );
    scene.add(skyDome);

    /* Cadrage responsive : en portrait (mobile) on rapproche la caméra
       et on élargit le champ pour que la ville et le car wash remplissent l'écran. */
    const isPortrait = () => window.innerHeight >= window.innerWidth;
    const camera = new THREE.PerspectiveCamera(
      isPortrait() ? 50 : 45,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );
    if (isPortrait()) camera.position.set(-26, 36, WASH_SITE_Z + 54);
    // Cadrage desktop/paysage : caméra au nord-ouest de la route principale,
    // regard vers le sud-est. La ville (route principale + parcelles) occupe le
    // centre/premier plan, le car wash reste visible en arrière-plan relié par
    // la route, les montagnes restent lointaines.
    else camera.position.set(-25, 24, 20);


    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(
      isPortrait() ? -4 : 5,
      1.5,
      isPortrait() ? WASH_SITE_Z + 12 : -15,
    );
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 160;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8fae7a, 0.9));

    const sun = new THREE.DirectionalLight(0xfff3d6, 1.6);
    sun.position.set(-15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0015;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: 0x7fc76b, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);


    const setShadow = (obj: THREE.Object3D) => {
      obj.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
    };

    const place = (
      template: THREE.Object3D,
      x: number,
      y: number,
      z: number,
      rotY = 0,
      scale = 1,
    ) => {
      const inst = template.clone(true);
      inst.position.set(x, y, z);
      inst.rotation.y = rotY;
      if (scale !== 1) inst.scale.setScalar(scale);
      setShadow(inst);
      scene.add(inst);
      return inst;
    };

    /* Les modèles Meshy sont exportés en Y-up mais avec une échelle et une
       orientation libres : on les tourne face à +X, on les met à l'échelle
       voulue et on les pose au sol. */
    const normalizeModel = (source: THREE.Object3D, targetLength: number) => {
      const root = new THREE.Group();
      const inner = new THREE.Group();
      inner.add(source);
      root.add(inner);

      const box0 = new THREE.Box3().setFromObject(inner);
      let box = box0;
      const size = box.getSize(new THREE.Vector3());


      // la plus grande dimension au sol suit l'axe X (sens de circulation)
      if (size.z > size.x) {
        inner.rotation.y = Math.PI / 2;
        inner.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(inner);
      }


      const finalSize = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      inner.position.set(-center.x, -box.min.y, -center.z);
      root.scale.setScalar(targetLength / Math.max(finalSize.x, 0.0001));
      setShadow(root);
      return root;
    };



    const isolateMaterials = (car: THREE.Object3D) => {
      const materials: THREE.MeshStandardMaterial[] = [];
      car.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.isMesh) {
          const cloned = (mesh.material as THREE.MeshStandardMaterial).clone();
          mesh.material = cloned;
          materials.push(cloned);
        }
      });
      return materials;
    };

    const tintCar = (car: THREE.Object3D, dirtiness: number) => {
      const data = car.userData as { materials?: THREE.MeshStandardMaterial[] };
      const materials = data.materials ?? isolateMaterials(car);
      data.materials = materials;
      materials.forEach((m) => {
        m.color.setHex(0xffffff).lerp(DIRT_COLOR, dirtiness);
      });
    };

    /* Récupère les roues et mémorise, pour chacune, le sens de rotation
       correct : certains modèles (4x4/SUV) ont des roues dont l'axe local
       est inversé, ce qui les faisait tourner à l'envers. */
    const findWheels = (car: THREE.Object3D) => {
      const wheels: THREE.Object3D[] = [];
      car.updateWorldMatrix(true, true);
      const carRight = new THREE.Vector3(1, 0, 0).transformDirection(
        car.matrixWorld,
      );
      car.traverse((n) => {
        if (n.name && n.name.toLowerCase().includes("wheel")) {
          const axis = new THREE.Vector3(1, 0, 0).transformDirection(
            n.matrixWorld,
          );
          n.userData['spinSign'] = axis.dot(carRight) < 0 ? -1 : 1;
          wheels.push(n);
        }
      });
      return wheels;
    };


    /* Rouleau de lavage : axe central + manchon de mousse sombre nervuré.
       On évite les milliers de micro-poils colorés qui produisaient un
       scintillement type « neige TV » une fois le rouleau mis à l'échelle. */
    const brushCoreMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3ad,
      roughness: 0.5,
      metalness: 0.35,
    });
    const brushPadMat = new THREE.MeshStandardMaterial({
      color: 0x2b2f36,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const brushRibMat = new THREE.MeshStandardMaterial({
      color: 0x1f6f9c,
      roughness: 0.85,
    });
    const brushCoreGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.9, 12);
    const brushPadGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.62, 16, 1);
    const brushRibGeo = new THREE.TorusGeometry(0.31, 0.035, 8, 20);

    const makeBrush = () => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(brushCoreGeo, brushCoreMat);
      core.castShadow = true;
      g.add(core);

      const pad = new THREE.Mesh(brushPadGeo, brushPadMat);
      pad.castShadow = true;
      g.add(pad);

      // quelques nervures espacées : lisible, sans bruit visuel
      for (let i = 0; i < 5; i++) {
        const rib = new THREE.Mesh(brushRibGeo, brushRibMat);
        rib.rotation.x = Math.PI / 2;
        rib.position.y = -0.62 + i * 0.31;
        g.add(rib);
      }
      return g;
    };


    const makeFoamVeil = () => {
      const group = new THREE.Group();
      const geo = new THREE.SphereGeometry(1, 6, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        roughness: 0.4,
      });
      for (let i = 0; i < 26; i++) {
        const s = new THREE.Mesh(geo, mat);
        s.scale.setScalar(0.05 + Math.random() * 0.12);
        s.position.set(
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 0.6,
        );
        group.add(s);
      }
      return group;
    };

    const makeTree = () => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.18, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x7a5230 }),
      );
      trunk.position.y = 0.55;
      trunk.castShadow = true;
      g.add(trunk);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9142, roughness: 1 });
      const leafGeo = new THREE.IcosahedronGeometry(0.85, 0);
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set((Math.random() - 0.5) * 0.4, 1.2 + i * 0.5, (Math.random() - 0.5) * 0.4);
        leaf.scale.setScalar(1 - i * 0.18);
        leaf.castShadow = true;
        g.add(leaf);
      }
      return g;
    };

    /* ---------- Décor naturel : collines, montagnes, lac ---------- */
    const rand = (() => {
      let seed = 1337;
      return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    })();

    const buildLandscape = () => {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b8f96, roughness: 1, flatShading: true });
      const rockDark = new THREE.MeshStandardMaterial({ color: 0x6f747c, roughness: 1, flatShading: true });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xf3f8ff, roughness: 0.9, flatShading: true });
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x6bb85c, roughness: 1, flatShading: true });
      const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x58a552, roughness: 1, flatShading: true });

      // Chaîne de montagnes lointaine, sur tout l'horizon (bien au-delà de la ville)
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2 + rand() * 0.06;
        const r = 340 + rand() * 150;
        const h = 70 + rand() * 110;
        const rad = h * (0.6 + rand() * 0.35);
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(rad, h, 5 + Math.floor(rand() * 3), 1),
          rand() > 0.5 ? rockMat : rockDark,
        );
        m.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
        m.rotation.y = rand() * Math.PI;
        scene.add(m);
        if (h > 110) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.34, h * 0.24, 6, 1), snowMat);
          cap.position.set(m.position.x, h - h * 0.12 - 4, m.position.z);
          cap.rotation.y = m.rotation.y;
          scene.add(cap);
        }
      }

      // Collines verdoyantes, basses, en avant-plan des montagnes
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 + rand() * 0.14;
        const r = 245 + rand() * 80;
        const h = 7 + rand() * 13;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        // on dégage la vallée du lac
        if (Math.hypot(x + 62, z - 34) < 110) continue;
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(h * 2.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
          rand() > 0.5 ? hillMat : hillMat2,
        );
        m.scale.y = 0.3 + rand() * 0.2;
        m.position.set(x, -1, z);
        scene.add(m);
      }


      // Buttes douces éparses : casse la platitude entre ville et collines
      for (let i = 0; i < 22; i++) {
        const a = rand() * Math.PI * 2;
        const r = 120 + rand() * 70;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.hypot(x, z + 42) < 60) continue; // dégage le terrain du car wash
        if (Math.hypot(x + 62, z - 34) < 60) continue; // dégage le lac
        const h = 4 + rand() * 9;
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(h * 2.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
          rand() > 0.5 ? hillMat : hillMat2,
        );
        m.scale.y = 0.3 + rand() * 0.22;
        m.position.set(x, -0.6, z);
        scene.add(m);
      }



      // Lac au nord-ouest + plage et arbres
      const lake = new THREE.Group();
      const sand = new THREE.Mesh(
        new THREE.CircleGeometry(22, 40),
        new THREE.MeshStandardMaterial({ color: 0xe4d6a8, roughness: 1 }),
      );
      sand.rotation.x = -Math.PI / 2;
      sand.position.y = 0.02;
      lake.add(sand);
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(18.5, 48),
        new THREE.MeshStandardMaterial({
          color: 0x3fa9d8,
          roughness: 0.15,
          metalness: 0.35,
          transparent: true,
          opacity: 0.92,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.05;
      lake.add(water);
      lake.position.set(-62, 0, 34);
      lake.scale.set(1.25, 1, 0.85);
      scene.add(lake);
      waterSurface = water;

      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const tr = makeTree();
        tr.position.set(
          -62 + Math.cos(a) * (28 + rand() * 6) * 1.25,
          0,
          34 + Math.sin(a) * (24 + rand() * 6) * 0.85,
        );
        tr.scale.setScalar(0.9 + rand() * 0.5);
        setShadow(tr);
        scene.add(tr);
      }

      // Bosquets épars entre la ville et les collines
      for (let i = 0; i < 46; i++) {
        const a = rand() * Math.PI * 2;
        const r = 58 + rand() * 55;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.abs(x) < 40 && Math.abs(z) < 52) continue;
        const tr = makeTree();
        tr.position.set(x, 0, z);
        tr.scale.setScalar(0.8 + rand() * 0.7);
        setShadow(tr);
        scene.add(tr);
      }

      /* Promenade en diagonale : casse la rigidité du quadrillage,
         relie l'angle nord-ouest de la ville au lac. */
      const from = new THREE.Vector2(-32, 24);
      const to = new THREE.Vector2(-50, 34);
      const dir = to.clone().sub(from);
      const promenade = new THREE.Mesh(
        new THREE.PlaneGeometry(dir.length() + 14, 4.4),
        new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: 1 }),
      );
      promenade.rotation.x = -Math.PI / 2;
      promenade.rotation.z = -Math.atan2(dir.y, dir.x);
      promenade.position.set((from.x + to.x) / 2, 0.03, (from.y + to.y) / 2);
      promenade.receiveShadow = true;
      scene.add(promenade);
    };



    /* ---------- Mobilier urbain : modèles Kenney ---------- */



    type TrafficLight = { axis: "x" | "z"; red: THREE.Mesh; green: THREE.Mesh };
    const trafficLights: TrafficLight[] = [];

    /* Feu tricolore Kenney (city-kit-roads) + deux ampoules émissives pour
       pouvoir piloter le cycle rouge/vert. */
    const makeTrafficLight = (axis: "x" | "z") => {
      const g = new THREE.Group();
      const model = kit["traffic-light"];
      if (model) {
        const inst = model.clone(true);
        inst.scale.setScalar(6);
        g.add(inst);
      }
      const bulb = (color: number, y: number) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 10, 10),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 }),
        );
        m.position.set(0, y, 0.28);
        g.add(m);
        return m;
      };
      const red = bulb(0xff3b30, 2.75);
      const green = bulb(0x33d17a, 2.25);
      trafficLights.push({ axis, red, green });
      return g;
    };



    // Tapis roulant : lattes qui défilent dans la zone de lavage
    const makeConveyor = () => {
      const group = new THREE.Group();
      const [zs, ze] = WASH_ZONE;
      const len = ze - zs;
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.12, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.8 }),
      );
      base.position.set((zs + ze) / 2, ROAD_Y + 0.06, 0);
      base.receiveShadow = true;
      group.add(base);

      const slatMat = new THREE.MeshStandardMaterial({ color: 0x596470, roughness: 0.6 });
      const slatGeo = new THREE.BoxGeometry(0.18, 0.06, 2.4);
      const slats: THREE.Mesh[] = [];
      const count = Math.round(len / 0.4);
      for (let i = 0; i < count; i++) {
        const s = new THREE.Mesh(slatGeo, slatMat);
        s.position.set(zs + i * 0.4, ROAD_Y + 0.14, 0);
        s.castShadow = true;
        group.add(s);
        slats.push(s);
      }
      return { group, slats };
    };

    const models: Record<string, THREE.Group> = {};
    /* Modèles Kenney extraits du pack : routes, voitures, bâtiments, mobilier */
    const kit: Record<string, THREE.Object3D> = {};
    const kitCar = (i: number) => {
      const name = KIT_CARS[i % KIT_CARS.length]!;
      return kit[name] ?? kit["sedan"] ?? models["sedan"]!;
    };

    type WashCar = {
      car: THREE.Object3D;
      d: number;
      speed: number;
      yaw: number;
      baseY: number;
      wheels: THREE.Object3D[];
      /* voiture du réseau empruntée : elle repart circuler après le lavage */
      origin: NetCar;
      /* true dès que le lavage a été facturé (évite les doubles paiements) */
      paid?: boolean;

    };
    const washCars: WashCar[] = [];


    const brushes: Array<{
      pivot: THREE.Object3D;
      spin: THREE.Object3D;
      dir: number;
      kind: "roller" | "brush";
    }> = [];
    const foamSprites: THREE.Object3D[] = [];
    const conveyorSlats: THREE.Mesh[] = [];
    /* ----- Réseau routier du joueur ----- */
    const plan = new CityPlan();
    const MAIN_CX = Math.round(WASH_ACCESS_X / TILE);
    const MAIN_CZ_START = -5; // première case au nord de la parcelle
    const MAIN_CZ_END = 12; // s'enfonce vers les reliefs du fond
    const LANE = 1.5;

    /* Voiture circulant de case en case sur le réseau construit. */
    type NetCar = {
      car: THREE.Object3D;
      wheels: THREE.Object3D[];
      speed: number;
      baseY: number;
      yaw: number;
      cx: number;
      cz: number;
      dirIn: Dir;
      dirOut: Dir;
      /** progression dans la case courante (0 → 1) */
      t: number;
    };
    const netCars: NetCar[] = [];

    /* Position/cap d'une voiture : courbe quadratique entrée → sortie de case,
       décalée à droite pour rester sur sa voie, y compris dans les virages. */
    const netPose = (e: NetCar) => {
      const cxw = e.cx * TILE;
      const czw = e.cz * TILE;
      const vin = DIR_VEC[e.dirIn]!;
      const vout = DIR_VEC[e.dirOut]!;
      const rin = rightOf(e.dirIn);
      const rout = rightOf(e.dirOut);
      const ax = cxw - (vin[0] * TILE) / 2 + rin[0] * LANE;
      const az = czw - (vin[1] * TILE) / 2 + rin[1] * LANE;
      const bx = cxw + (vout[0] * TILE) / 2 + rout[0] * LANE;
      const bz = czw + (vout[1] * TILE) / 2 + rout[1] * LANE;
      const ccx = cxw + ((rin[0] + rout[0]) * LANE) / 2;
      const ccz = czw + ((rin[1] + rout[1]) * LANE) / 2;
      const u = 1 - e.t;
      const x = u * u * ax + 2 * u * e.t * ccx + e.t * e.t * bx;
      const z = u * u * az + 2 * u * e.t * ccz + e.t * e.t * bz;
      const dx = 2 * u * (ccx - ax) + 2 * e.t * (bx - ccx);
      const dz = 2 * u * (ccz - az) + 2 * e.t * (bz - ccz);
      return { x, z, heading: Math.atan2(dx, dz) };
    };

    /* Toute la station de lavage (tunnel, tapis, brosses, voitures à laver)
       vit dans ce groupe : ses coordonnées locales restent inchangées. */
    const washSite = new THREE.Group();
    washSite.position.z = WASH_SITE_Z;
    scene.add(washSite);
    /* Portique de lavage provisoire (Kenney) remplacé par le modèle Meshy
       détaillé dès qu'il est chargé. */
    let tunnelPlaceholder: THREE.Object3D | null = null;

    /* Rendu du plan : tuiles de route auto-raccordées + mobilier posé. */
    const roadsGroup = new THREE.Group();
    scene.add(roadsGroup);
    const propsGroup = new THREE.Group();
    scene.add(propsGroup);

    const renderPlan = () => {
      [...roadsGroup.children].forEach((c) => roadsGroup.remove(c));
      [...propsGroup.children].forEach((c) => propsGroup.remove(c));
      trafficLights.length = 0;
      plan.cells.forEach((cell, k) => {
        const [cx, cz] = parseKey(k);
        const { model, rot } = plan.variantAt(cx, cz);
        const tpl = kit[model] ?? kit["road-straight"];
        if (tpl) {
          const tile = tpl.clone(true);
          tile.scale.setScalar(TILE);
          tile.position.set(cx * TILE, 0.012, cz * TILE);
          tile.rotation.y = (rot * Math.PI) / 2;
          tile.traverse((n) => {
            const m = n as THREE.Mesh;
            if (m.isMesh) m.receiveShadow = true;
          });
          roadsGroup.add(tile);
        }
        if (cell.light) {
          const off = TILE / 2 - 0.6;
          ([
            ["x", -off, -off],
            ["z", off, off],
          ] as const).forEach(([axis, ox, oz]) => {
            const l = makeTrafficLight(axis);
            l.position.set(cx * TILE + ox, 0, cz * TILE + oz);
            l.rotation.y = Math.atan2(-ox, -oz);
            setShadow(l);
            propsGroup.add(l);
          });
        }
        if (cell.lamp) {
          const tplL = kit["light-square"];
          if (tplL) {
            const lamp = tplL.clone(true);
            lamp.scale.setScalar(6);
            lamp.position.set(cx * TILE - TILE / 2 + 0.7, 0, cz * TILE + TILE / 2 - 0.7);
            setShadow(lamp);
            propsGroup.add(lamp);
          }
        }
      });
    };

    let ti = 0;
    const spawnNetCar = (cx: number, cz: number) => {
      const car = kitCar(ti).clone(true);
      setShadow(car);
      scene.add(car);
      const exits = plan.exitsAt(cx, cz);
      const dirOut = (exits[0] ?? 0) as Dir;
      netCars.push({
        car,
        wheels: findWheels(car),
        speed: 3.4 + (ti % 3) * 0.5,
        baseY: 0,
        yaw: 0,
        cx,
        cz,
        dirIn: dirOut,
        dirOut,
        t: Math.random() * 0.5,
      });
      ti++;
    };

    /* ----- Itinéraire routier complet : route → parcelle → tunnel → retour ----- */
    const CITY_SOUTH = MAIN_CZ_START * TILE; // départ sur la route principale
    const SITE_ROAD_Z = WASH_SITE_Z + 13; // rue est-ouest de la parcelle
    const WASH_IN_X = PATH_START;
    const WASH_OUT_X = PATH_END;
    const ROUTE: Array<[number, number]> = [
      [WASH_ACCESS_X - 1.25, CITY_SOUTH],
      [WASH_ACCESS_X - 1.25, SITE_ROAD_Z - 1.25],
      [WASH_IN_X, SITE_ROAD_Z - 1.25],
      [WASH_IN_X, WASH_SITE_Z],
      [WASH_OUT_X, WASH_SITE_Z],
      [WASH_OUT_X, SITE_ROAD_Z + 1.25],
      [WASH_ACCESS_X + 1.25, SITE_ROAD_Z + 1.25],
      [WASH_ACCESS_X + 1.25, CITY_SOUTH],
    ];
    const ROUTE_CUM: number[] = [0];
    for (let i = 1; i < ROUTE.length; i++) {
      const a = ROUTE[i - 1]!;
      const b = ROUTE[i]!;
      ROUTE_CUM.push(ROUTE_CUM[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const ROUTE_LEN = ROUTE_CUM[ROUTE_CUM.length - 1]!;
    // portion de l'itinéraire correspondant à la zone de lavage
    const WASH_D0 = ROUTE_CUM[3]! + (WASH_ZONE[0] - WASH_IN_X);
    const WASH_D1 = ROUTE_CUM[3]! + (WASH_ZONE[1] - WASH_IN_X);

    const posAt = (d: number) => {
      const dd = Math.min(Math.max(d, 0), ROUTE_LEN);
      let i = 1;
      while (i < ROUTE_CUM.length - 1 && ROUTE_CUM[i]! < dd) i++;
      const a = ROUTE[i - 1]!;
      const b = ROUTE[i]!;
      const segLen = ROUTE_CUM[i]! - ROUTE_CUM[i - 1]!;
      const k = segLen > 0 ? (dd - ROUTE_CUM[i - 1]!) / segLen : 0;
      const x = a[0] + (b[0] - a[0]) * k;
      const z = a[1] + (b[1] - a[1]) * k;
      const heading = Math.atan2(b[0] - a[0], b[1] - a[1]);
      return { x, z, heading };
    };

    /* Une voiture du réseau décide spontanément d'aller au lavage : celle qui
       est la plus proche de la parcelle quitte la circulation, suit
       l'itinéraire jusqu'au tunnel, puis repart rouler une fois propre. */
    let washCooldown = 6 + Math.random() * 6;
    const sendCityCarToWash = () => {
      if (netCars.length <= 2) return;
      const start = posAt(0);
      let best = -1;
      let bestD = Infinity;
      netCars.forEach((c, i) => {
        const d =
          (c.car.position.x - start.x) ** 2 + (c.car.position.z - start.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) return;
      const origin = netCars.splice(best, 1)[0];
      if (!origin) return;
      origin.car.position.set(start.x, origin.baseY, start.z);
      tintCar(origin.car, 1);
      washCars.push({
        car: origin.car,
        d: 0,
        speed: 5.2,
        yaw: origin.yaw,
        baseY: origin.baseY,
        wheels: origin.wheels,
        origin,
      });
    };







    let cinemaMode = false;
    cinemaRef.current = () => {
      cinemaMode = !cinemaMode;
      controls.enabled = !cinemaMode;
      setCinema(cinemaMode);
    };

    const STREET_W = TILE; // largeur d'une chaussée = une tuile Kenney



    const buildScene = () => {
      buildLandscape();



      /* ----- Grand portique de lavage (structure bien visible) ----- */
      const hallMat = new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.75 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1f6fb2, roughness: 0.6 });
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x9ad4ee,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.55,
      });
      const HALL_LEN = 15; // le long de x (sens de circulation)
      const HALL_W = 9.5; // le long de z
      const HALL_H = 5.2;
      const HALL_CX = 2;
      const hall = new THREE.Group();

      // Murs latéraux + bandeaux vitrés
      [-1, 1].forEach((s) => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(HALL_LEN, HALL_H, 0.4),
          hallMat,
        );
        wall.position.set(HALL_CX, HALL_H / 2, (s * HALL_W) / 2);
        wall.castShadow = true;
        wall.receiveShadow = true;
        hall.add(wall);

        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(HALL_LEN - 2, 1.6, 0.12),
          glassMat,
        );
        glass.position.set(HALL_CX, 3.2, (s * (HALL_W + 0.5)) / 2);
        hall.add(glass);
      });

      // Toiture + acrotère coloré
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(HALL_LEN + 1.4, 0.5, HALL_W + 1.4),
        hallMat,
      );
      roof.position.set(HALL_CX, HALL_H + 0.25, 0);
      roof.castShadow = true;
      hall.add(roof);
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(HALL_LEN + 1.6, 0.55, HALL_W + 1.6),
        trimMat,
      );
      band.position.set(HALL_CX, HALL_H + 0.75, 0);
      hall.add(band);

      // Portiques d'entrée et de sortie (arches marquées)
      [-1, 1].forEach((s) => {
        const arch = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 1.5, HALL_W + 1.8),
          trimMat,
        );
        arch.position.set(HALL_CX + (s * HALL_LEN) / 2, HALL_H - 0.4, 0);
        hall.add(arch);
        [-1, 1].forEach((z) => {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, HALL_H, 0.8),
            trimMat,
          );
          post.position.set(
            HALL_CX + (s * HALL_LEN) / 2,
            HALL_H / 2,
            (z * (HALL_W + 1.8)) / 2,
          );
          post.castShadow = true;
          hall.add(post);
        });
      });

      // Totem d'enseigne "CAR WASH"
      const totemPost = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 6, 0.4),
        trimMat,
      );
      totemPost.position.set(HALL_CX - HALL_LEN / 2 - 3, 3, HALL_W / 2 + 2.5);
      totemPost.castShadow = true;
      hall.add(totemPost);
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 512;
      signCanvas.height = 160;
      const sctx = signCanvas.getContext("2d")!;
      sctx.fillStyle = "#1f6fb2";
      sctx.fillRect(0, 0, 512, 160);
      sctx.fillStyle = "#ffffff";
      sctx.font = "bold 90px sans-serif";
      sctx.textAlign = "center";
      sctx.textBaseline = "middle";
      sctx.fillText("CAR WASH", 256, 84);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.9, 0.25), signMat);
      sign.position.set(HALL_CX - HALL_LEN / 2 - 3, 6.4, HALL_W / 2 + 2.5);
      sign.castShadow = true;
      hall.add(sign);
      // Enseigne murale identique sur le long pan
      const wallSign = new THREE.Mesh(new THREE.BoxGeometry(8, 2.4, 0.2), signMat);
      wallSign.position.set(HALL_CX, HALL_H - 1.2, HALL_W / 2 + 0.3);
      hall.add(wallSign);

      washSite.add(hall);

      const tunnel = models["tunnel"]!.clone(true);
      tunnel.rotation.y = Math.PI / 2;
      tunnel.scale.setScalar(1.5);
      tunnel.position.set(2, 0, 0);
      setShadow(tunnel);
      washSite.add(tunnel);
      tunnelPlaceholder = tunnel;



      // Tapis roulant
      const conveyor = makeConveyor();
      washSite.add(conveyor.group);
      conveyorSlats.push(...conveyor.slats);

      /* Rouleaux verticaux : deux paires à l'entrée (bien visibles depuis
         l'extérieur) et deux paires à l'intérieur du portique. */
      [-1, 1].forEach((zSide, si) => {
        [-1.1, 1.2, 3.4].forEach((offset, oi) => {
          const pivot = new THREE.Group();
          const spin = makeBrush();
          spin.scale.set(1.7, 1.7, 1.7);
          pivot.add(spin);
          pivot.position.set(WASH_ZONE[0] + offset, ROAD_Y + 1.4, zSide * 1.9);
          washSite.add(pivot);

          brushes.push({
            pivot,
            spin,
            dir: (si + oi) % 2 === 0 ? 1 : -1,
            kind: "roller",
          });
        });
      });

      // Brosses horizontales au-dessus du tapis (elles descendent sur la voiture)
      [-0.4, 2.2, 4.6].forEach((x, i) => {
        const pivot = new THREE.Group();
        pivot.rotation.x = Math.PI / 2;
        const spin = makeBrush();
        spin.scale.set(1.5, 2.1, 1.5);
        pivot.add(spin);
        pivot.position.set(x, ROAD_Y + 2.4, 0);
        washSite.add(pivot);
        brushes.push({ pivot, spin, dir: i % 2 === 0 ? -1 : 1, kind: "brush" });
      });



      for (let i = 0; i < 2; i++) {
        const foam = makeFoamVeil();
        foam.position.set(1.5 + i * 2, ROAD_Y + 1.2, 0);
        washSite.add(foam);
        foamSprites.push(foam);
      }


      // ----- Sols et matériaux partagés -----
      const asphalt = new THREE.MeshStandardMaterial({
        color: 0x4a4f57,
        roughness: 0.95,
      });
      const sidewalkMat = new THREE.MeshStandardMaterial({
        color: 0xd6d2c4,
        roughness: 1,
      });
      const dashMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0d8,
        roughness: 0.7,
      });
      const lawnMat = new THREE.MeshStandardMaterial({ color: 0x7fc76b, roughness: 1 });
      const dashGeoX = new THREE.PlaneGeometry(1.4, 0.16);
      const zMin = MAIN_CZ_START * TILE; // extrémité sud de la route principale

      const addSlab = (
        mat: THREE.Material,
        w: number,
        d: number,
        x: number,
        z: number,
        y: number,
      ) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y, z);
        m.receiveShadow = true;
        scene.add(m);
        return m;
      };

      /* ----- Route principale : du car wash vers les reliefs du fond -----
         Elle est posée par le jeu et ne peut pas être effacée ; tout le reste
         du réseau est construit par le joueur. */
      for (let cz = MAIN_CZ_START; cz <= MAIN_CZ_END; cz++) {
        plan.place(MAIN_CX, cz, "straight", 0, true);
      }
      renderPlan();





      /* ----- Parcelle dédiée du car wash (périphérie sud) ----- */
      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x9aa0a6,
        roughness: 1,
      });

      /* Voie d'accès : déjà pavée en tuiles Kenney ci-dessus, on ajoute
         seulement la bande enherbée de bord. */
      const accessLen = zMin - WASH_SITE_Z;
      const accessCz = (zMin + WASH_SITE_Z) / 2;
      addSlab(sidewalkMat, STREET_W + 2.4, accessLen, WASH_ACCESS_X, accessCz, 0.004);


      // Terrain de la station : pelouse + dalle béton (parcelle resserrée)
      addSlab(lawnMat, 38, 21, 0, WASH_SITE_Z + 2, 0.008);
      addSlab(concreteMat, 32, 16, 0, WASH_SITE_Z + 2.5, 0.012);

      // Voie de lavage (traversée est-ouest de la parcelle)
      addSlab(asphalt, 30, STREET_W, 0, WASH_SITE_Z, 0.02);
      for (let x = -14; x <= 14; x += 3) {
        if (x > PATH_START + 2 && x < PATH_END - 2) continue;
        const d = new THREE.Mesh(dashGeoX, dashMat);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.03, WASH_SITE_Z);
        scene.add(d);
      }


      /* Rue de desserte est-ouest de la parcelle + raccords vers la voie de
         lavage : les voitures suivent la route de bout en bout. */
      const siteRoadW = STREET_W;
      addSlab(sidewalkMat, 40, siteRoadW + 1.2, 0, SITE_ROAD_Z, 0.005);
      addSlab(asphalt, 40, siteRoadW, 0, SITE_ROAD_Z, 0.02);
      [WASH_IN_X, WASH_OUT_X].forEach((cx) => {
        const len = SITE_ROAD_Z - WASH_SITE_Z + siteRoadW;
        const cz = (SITE_ROAD_Z + WASH_SITE_Z) / 2;
        addSlab(sidewalkMat, siteRoadW + 1.2, len, cx, cz, 0.005);
        addSlab(asphalt, siteRoadW, len, cx, cz, 0.021);
      });


      // Parking : places marquées, voitures bien rangées dans les cases
      const parkZ = WASH_SITE_Z + 8;
      addSlab(concreteMat, 24, 7.5, -2, parkZ, 0.016);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.8 });
      for (let i = 0; i <= 5; i++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 6), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(-12 + i * 4.4, 0.024, parkZ);
        scene.add(line);
      }
      // Voitures Kenney en attente, alignées au centre de leur place
      [0, 1, 2, 3].forEach((i) => {
        const parked = kitCar(i * 2 + 4).clone(true);
        setShadow(parked);
        parked.rotation.y = Math.PI / 2;
        parked.position.set(-12 + 2.2 + i * 4.4, 0, parkZ);
        scene.add(parked);
      });

      /* Arbres de la parcelle : uniquement sur la pelouse, jamais sur la
         chaussée (voie de lavage, rue de desserte, raccords, accès ville). */
      const onSiteRoad = (x: number, z: number) => {
        const halfW = STREET_W / 2 + 1.2;
        if (Math.abs(z - WASH_SITE_Z) <= halfW) return true; // voie de lavage
        if (Math.abs(z - SITE_ROAD_Z) <= halfW) return true; // rue de desserte
        const inLink = z >= WASH_SITE_Z - halfW && z <= SITE_ROAD_Z + halfW;
        if (inLink && (Math.abs(x - WASH_IN_X) <= halfW || Math.abs(x - WASH_OUT_X) <= halfW))
          return true;
        if (z >= WASH_SITE_Z && Math.abs(x - WASH_ACCESS_X) <= halfW) return true;
        return false;
      };
      const plantSiteTree = (x: number, z: number) => {
        if (onSiteRoad(x, z)) return;
        const tr = makeTree();
        tr.position.set(x, 0, z);
        tr.scale.setScalar(0.9);
        setShadow(tr);
        scene.add(tr);
      };
      // bande enherbée au nord de la voie de lavage
      for (let x = -17; x <= 17; x += 4.5) plantSiteTree(x, WASH_SITE_Z - 6.8);
      // bordures est / ouest de la parcelle
      for (let z = WASH_SITE_Z - 7; z <= SITE_ROAD_Z + 4; z += 4.5) {
        plantSiteTree(-18.5, z);
        plantSiteTree(18.5, z);
      }


      // ----- Trafic initial : quelques voitures sur la route principale -----
      for (let i = 0; i < 6; i++) {
        spawnNetCar(MAIN_CX, MAIN_CZ_START + 2 + i * 2);
      }
    };

    /* ---------- Mode construction : le joueur pose son réseau ---------- */
    const gridHelper = new THREE.GridHelper(TILE * 30, 30, 0x2b6cb0, 0x9ec5e8);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.3;
    gridHelper.position.y = 0.04;
    gridHelper.visible = false;
    scene.add(gridHelper);

    const ghost = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.94, TILE * 0.94),
      new THREE.MeshBasicMaterial({ color: 0x2bd07c, transparent: true, opacity: 0.45 }),
    );
    ghost.rotation.x = -Math.PI / 2;
    ghost.position.y = 0.07;
    ghost.visible = false;
    scene.add(ghost);

    const BUILD_MIN_CZ = MAIN_CZ_START + 1;
    const BUILD_MAX_CZ = MAIN_CZ_END + 2;
    const BUILD_MAX_CX = 12;
    const canBuild = (cx: number, cz: number) =>
      Math.abs(cx) <= BUILD_MAX_CX &&
      cz >= BUILD_MIN_CZ &&
      cz <= BUILD_MAX_CZ &&
      !plan.get(cx, cz)?.locked;

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const cellUnderPointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(groundPlane, hitPoint)) return null;
      return { cx: worldToCell(hitPoint.x), cz: worldToCell(hitPoint.z) };
    };

    let downAt: { x: number; y: number } | null = null;
    const onPointerMove = (ev: PointerEvent) => {
      if (!buildRef.current) {
        ghost.visible = false;
        return;
      }
      const c = cellUnderPointer(ev);
      if (!c) {
        ghost.visible = false;
        return;
      }
      ghost.visible = true;
      ghost.position.set(c.cx * TILE, 0.07, c.cz * TILE);
      const existing = plan.get(c.cx, c.cz);
      const tool = toolRef.current;
      const ok =
        tool === "erase"
          ? !!existing && !existing.locked
          : tool === "light" || tool === "lamp"
            ? !!existing
            : canBuild(c.cx, c.cz);
      (ghost.material as THREE.MeshBasicMaterial).color.set(ok ? 0x2bd07c : 0xe05252);
    };
    const onPointerDown = (ev: PointerEvent) => {
      downAt = { x: ev.clientX, y: ev.clientY };
    };
    const onPointerUp = (ev: PointerEvent) => {
      const start = downAt;
      downAt = null;
      if (!buildRef.current || !start) return;
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) return;
      const c = cellUnderPointer(ev);
      if (!c) return;
      const tool = toolRef.current;
      if (tool === "erase") {
        if (plan.remove(c.cx, c.cz)) renderPlan();
        return;
      }
      if (tool === "light" || tool === "lamp") {
        const cell = plan.get(c.cx, c.cz);
        if (!cell) return;
        plan.setProp(c.cx, c.cz, tool, !cell[tool]);
        renderPlan();
        return;
      }
      if (!canBuild(c.cx, c.cz)) return;
      plan.place(c.cx, c.cz, tool, rotRef.current);
      renderPlan();
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    buildApplyRef.current = (on: boolean) => {
      gridHelper.visible = on;
      controls.enableRotate = !on;
      if (!on) ghost.visible = false;
    };
    planIoRef.current = {
      save: () => plan.serialize(),
      load: (data) => {
        plan.load(data);
        renderPlan();
      },
    };




    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // léger clapotis sur les surfaces d'eau
      if (waterSurface) waterSurface.position.y = 0.05 + Math.sin(t * 0.8) * 0.03;
      


      const ctl = machinesRef.current;
      const SPEED = 2.6;
      /* même tapis à l'arrêt, la voiture avance lentement pour ne jamais
         rester bloquée dans le portique */
      const BELT_SPEED = ctl.belt ? 1.1 : 0.45;
      const GAP = 3.2;
      const [zoneStart, zoneEnd] = WASH_ZONE;

      // Les voitures suivent l'itinéraire routier ; la première est en tête
      let aheadD = Number.POSITIVE_INFINITY;

      for (let i = 0; i < washCars.length; i++) {
        const e = washCars[i]!;
        const onBelt = e.d >= WASH_D0 && e.d <= WASH_D1;
        const wantSpeed = onBelt ? BELT_SPEED : e.speed;

        // Limite : garder une distance de sécurité avec la voiture devant
        let limit = aheadD - GAP;
        /* Portail d'entrée : on n'attend que si une AUTRE voiture (devant)
           occupe encore le tunnel. */
        if (!onBelt && e.d < WASH_D0 && aheadD < WASH_D1) {
          limit = Math.min(limit, WASH_D0 - 0.6);
        }


        const target = Math.min(e.d + dt * wantSpeed, limit);
        const moved = Math.max(target - e.d, 0);
        e.d += moved;

        /* Lavage terminé : la voiture sort du tunnel et paye la prestation. */
        if (!e.paid && e.d >= WASH_D1) {
          e.paid = true;
          registerWashRef.current(6 + Math.floor(Math.random() * 7));
        }

        e.wheels.forEach((w) => {
          w.rotation.x -= ((w.userData['spinSign'] as number) ?? 1) * (moved / 0.35) * 2;
        });

        let dirtiness: number;
        if (e.d <= WASH_D0) dirtiness = 1;
        else if (e.d >= WASH_D1) dirtiness = 0;
        else dirtiness = 1 - (e.d - WASH_D0) / (WASH_D1 - WASH_D0);
        tintCar(e.car, dirtiness);

        const p = posAt(e.d);
        e.car.position.set(
          p.x,
          onBelt ? e.baseY + 0.14 + Math.sin(t * 30) * 0.012 : e.baseY,
          p.z,
        );
        // rotation douce vers la direction de la route (virages)
        const targetRot = p.heading + e.yaw;
        let delta = targetRot - e.car.rotation.y;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        e.car.rotation.y += delta * Math.min(dt * 8, 1);

        aheadD = e.d;
      }

      /* Fin de l'itinéraire : la voiture, propre, reprend la route principale */
      for (let i = washCars.length - 1; i >= 0; i--) {
        const e = washCars[i]!;
        if (e.d >= ROUTE_LEN - 0.05) {
          const o = e.origin;
          tintCar(o.car, 0);
          o.cx = MAIN_CX;
          o.cz = MAIN_CZ_START;
          o.dirIn = 0;
          o.dirOut = 0; // repart vers le nord
          o.t = 0.1;
          netCars.push(o);
          washCars.splice(i, 1);
        }
      }



      /* De temps en temps, une voiture de la ville part au lavage. */
      washCooldown -= dt;
      if (washCooldown <= 0) {
        washCooldown = 9 + Math.random() * 12;
        if (ctl.traffic && washCars.length < 3) sendCityCarToWash();
      }

      const carInWash = washCars.some((c) => c.d > WASH_D0 && c.d < WASH_D1);


      /* Rouleaux et brosses : rotation continue, accélérée au passage d'une
         voiture ; ils se resserrent et descendent sur la carrosserie. */
      const brushSpeed = carInWash ? 11 : 2.5;
      brushes.forEach((b, i) => {
        const on = b.kind === "roller" ? ctl.rollers : ctl.brushes;
        if (on) b.spin.rotation.y += dt * brushSpeed * b.dir;
        const engage = carInWash ? 1 : 0;
        const wobble = carInWash ? Math.sin(t * 6 + i) * 0.06 : 0;
        if (b.kind === "roller") {
          const side = Math.sign(b.pivot.position.z) || 1;
          const target = side * (1.45 - engage * 0.32 + wobble);
          b.pivot.position.z += (target - b.pivot.position.z) * Math.min(dt * 4, 1);
        } else {
          const target = ROAD_Y + 2.1 - engage * 0.42 + wobble;
          b.pivot.position.y += (target - b.pivot.position.y) * Math.min(dt * 4, 1);
        }
      });

      // Tapis roulant : les lattes défilent en boucle
      const beltLen = zoneEnd - zoneStart;
      if (ctl.belt) {
        conveyorSlats.forEach((s) => {
          s.position.x += dt * BELT_SPEED;
          if (s.position.x > zoneEnd) s.position.x -= beltLen;
        });
      }

      /* Circulation sur le réseau construit par le joueur : chaque voiture
         traverse une case, choisit une sortie au carrefour et s'arrête aux
         feux posés par le joueur. */
      const LIGHT_CYCLE = 9; // secondes par phase
      const phase = Math.floor(t / LIGHT_CYCLE) % 2;
      const greenAxis: "x" | "z" = phase === 0 ? "x" : "z";

      netCars.forEach((e) => {
        if (!ctl.traffic) return;
        const step = dt * e.speed;
        const nt = e.t + step / TILE;

        // distance de sécurité avec la voiture devant, dans la même case
        const tooClose = netCars.some(
          (o) =>
            o !== e && o.cx === e.cx && o.cz === e.cz && o.t > e.t && o.t - e.t < 0.4,
        );
        if (tooClose) return;

        if (nt < 1) {
          e.t = nt;
        } else {
          const [dx, dz] = DIR_VEC[e.dirOut]!;
          const nx = e.cx + dx;
          const nz = e.cz + dz;
          const next = plan.get(nx, nz);
          if (!next) {
            // cul-de-sac : demi-tour sans quitter la chaussée
            e.dirIn = e.dirOut;
            e.dirOut = opposite(e.dirIn);
            e.t = 0;
          } else {
            const busy =
              netCars.filter((o) => o !== e && o.cx === nx && o.cz === nz).length >= 2;
            const red = next.light && axisOf(e.dirOut) !== greenAxis;
            if (busy || red) {
              e.t = 0.97;
              return;
            }
            e.cx = nx;
            e.cz = nz;
            e.dirIn = e.dirOut;
            e.t = Math.min(nt - 1, 0.5);
            const exits = plan.exitsFrom(nx, nz, e.dirIn);
            e.dirOut =
              exits.includes(e.dirIn) && Math.random() < 0.65
                ? e.dirIn
                : exits[Math.floor(Math.random() * exits.length)]!;
          }
        }

        e.wheels.forEach((w) => {
          w.rotation.x -= ((w.userData['spinSign'] as number) ?? 1) * (step / 0.35) * 2;
        });
      });

      netCars.forEach((e) => {
        const p = netPose(e);
        e.car.position.set(p.x, e.baseY, p.z);
        let delta = p.heading + e.yaw - e.car.rotation.y;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        e.car.rotation.y += delta * Math.min(dt * 8, 1);
      });

      // Feux : vert sur l'axe qui passe, rouge sur l'autre
      trafficLights.forEach((l) => {
        const green = ctl.traffic && l.axis === greenAxis;
        (l.green.material as THREE.MeshStandardMaterial).emissiveIntensity = green ? 1.4 : 0.06;
        (l.red.material as THREE.MeshStandardMaterial).emissiveIntensity = green ? 0.06 : 1.4;
      });






      foamSprites.forEach((f) => {
        f.children.forEach((s, j) => {
          s.position.y += Math.sin(t * 4 + j) * 0.001;
        });
        f.visible = carInWash;
      });


      if (cinemaMode) {
        const angle = t * 0.18;
        camera.position.set(
          Math.cos(angle) * 20,
          11 + Math.sin(t * 0.3) * 2,
          Math.sin(angle) * 20 + 2 + WASH_SITE_Z,
        );
        camera.lookAt(2, 2, WASH_SITE_Z);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = isPortrait() ? 50 : 45;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onResize);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const loadAll = async () => {
      const res = await fetch(modelsAsset.url);
      const data = (await res.json()) as Record<string, string>;
      await Promise.all(
        MODEL_KEYS.map(
          (k) =>
            new Promise<void>((resolve, reject) => {
              loader.parse(
                b64ToArrayBuffer(data[k]!),
                "",
                (gltf) => {
                  models[k] = gltf.scene;
                  resolve();
                },
                (err) => reject(err instanceof Error ? err : new Error(String(err))),
              );
            }),
        ),
      );

      // Pack Kenney (routes, voitures, bâtiments, mobilier) en un seul GLB
      const pack = await new Promise<THREE.Group>((resolve, reject) => {
        loader.load(
          kenneyPackAsset.url,
          (gltf) => resolve(gltf.scene),
          undefined,
          (err) => reject(err instanceof Error ? err : new Error(String(err))),
        );
      });
      [...pack.children].forEach((child) => {
        child.removeFromParent();
        kit[child.name] = child;
      });
    };


    const loadMeshy = async () => {
      const load = (url: string) =>
        new Promise<THREE.Group>((resolve, reject) => {
          loader.load(
            url,
            (gltf) => resolve(gltf.scene),
            undefined,
            (err) => reject(err instanceof Error ? err : new Error(String(err))),
          );
        });

      // Tunnel de lavage : le modèle Meshy détaillé remplace le portique Kenney
      await load(tunnelAsset.url)
        .then((raw) => {
          if (disposed) return;
          const meshyTunnel = normalizeModel(raw, 11);
          // On le contient sous la toiture du hall
          const tb = new THREE.Box3().setFromObject(meshyTunnel);
          const th = tb.max.y - tb.min.y;
          const maxH = 4.6;
          if (th > maxH) meshyTunnel.scale.multiplyScalar(maxH / th);
          meshyTunnel.position.set(2, 0, 0);
          setShadow(meshyTunnel);
          washSite.add(meshyTunnel);
          if (tunnelPlaceholder) {
            washSite.remove(tunnelPlaceholder);
            tunnelPlaceholder = null;
          }
        })
        .catch((err: unknown) => console.error("tunnel Meshy", err));

    };



    loadAll()
      .then(() => {
        if (disposed) return;
        buildScene();
        setLoading(false);
        animate();


        void loadMeshy();
      })
      .catch((err: unknown) => {
        console.error(err);
        setMessage("Oups, un modèle n'a pas pu charger.");
      });


    return () => {
      disposed = true;
      cancelAnimationFrame(frame);

      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };


  }, []);

  return (
    <>
      <div ref={wrapRef} className="fixed inset-0" />

      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[linear-gradient(180deg,var(--sky-top),var(--sky-mid)_55%,var(--sky-bottom))] transition-opacity duration-500">
          <div className="size-16 animate-bounce rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffffff,var(--sky-mid)_70%,var(--sky-top))] shadow-[0_0_0_8px_rgba(255,255,255,.5),0_0_30px_rgba(255,255,255,.8)]" />
          <span className="mt-5 text-sm font-semibold tracking-wide text-ink">{message}</span>
        </div>
      )}

      <div className="pointer-events-none fixed left-2 top-2 z-40 max-w-[calc(100vw-146px)] rounded-2xl bg-white/90 ring-1 ring-ink/10 px-3 py-2 text-ink shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur sm:left-4 sm:top-4 sm:max-w-[300px] sm:px-4 sm:py-3">
        <p className="flex items-center gap-2 text-[17px] font-bold tracking-wide sm:text-[22px]">
          <span aria-hidden>🫧</span> TikowikoCity
        </p>

        {player && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-splash/15 px-2 py-1.5">
            <img
              src={avatarSrc(player.avatarId)}
              alt={`Avatar de ${player.name}`}
              loading="lazy"
              width={512}
              height={512}
              className="size-8 rounded-full bg-white object-contain ring-1 ring-ink/10 sm:size-9"
            />
            <span className="truncate text-[13px] font-bold sm:text-[14px]">{player.name}</span>
          </div>
        )}

        <div className="relative mt-2 flex items-center gap-2 rounded-xl bg-sunny/25 px-2 py-1.5 ring-1 ring-ink/10">
          <span aria-hidden className="text-[15px]">💰</span>
          <span className="text-[15px] font-extrabold tabular-nums sm:text-[17px]">
            {economy.money.toLocaleString("fr-FR")} €
          </span>
          <span className="ml-auto text-[11px] font-semibold opacity-70">
            {economy.washes} lavage{economy.washes > 1 ? "s" : ""}
          </span>
          {gain && (
            <span
              key={gain.id}
              className="absolute -top-3 right-1 animate-bounce text-[13px] font-extrabold text-splash"
            >
              +{gain.amount} €
            </span>
          )}
        </div>


        <p className="mt-1 hidden text-[12.5px] leading-relaxed opacity-80 sm:block">
          Construit avec les kits Kenney (voitures, routes, bâtiments). Glisse pour tourner la
          caméra, molette pour zoomer.
        </p>
      </div>



      <div className="pointer-events-none fixed bottom-2 left-2 z-30 hidden max-w-[46vw] rounded-2xl bg-white/70 px-3 py-2 text-[11.5px] sm:bottom-4 sm:left-4 sm:block text-ink shadow-[0_6px_20px_rgba(6,58,94,0.14)] backdrop-blur">
        <p>🖱️ Glisser = tourner • Molette = zoomer • Clic droit = déplacer</p>
        <p className="mt-1 opacity-80">Modèles Kenney (kenney.nl) — licence CC0</p>
        <p className="mt-1 font-semibold opacity-90">© {new Date().getFullYear()} tikowikoFamily</p>

      </div>


      <div className="fixed right-2 top-2 z-40 w-[118px] rounded-2xl bg-white/90 ring-1 ring-ink/10 p-2 sm:right-4 sm:top-4 sm:w-[190px] sm:p-3 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink opacity-80">
          Panneau de contrôle
        </p>
        <div className="flex flex-col gap-1.5">
          {(
            [
              ["belt", "🛤️ Tapis"],
              ["rollers", "🌀 Rouleaux"],
              ["brushes", "🧽 Brosses"],
              ["traffic", "🚦 Trafic"],
            ] as Array<[keyof typeof machines, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleMachine(key)}
              aria-pressed={machines[key]}
              className={`flex items-center justify-between rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 sm:py-2 sm:text-[12.5px] ${
                machines[key]
                  ? "bg-splash text-splash-foreground"
                  : "bg-ink/10 text-ink opacity-70"
              }`}
            >
              <span>{label}</span>
              <span className="text-[11px]">{machines[key] ? "ON" : "OFF"}</span>
            </button>
          ))}
        </div>
      </div>


      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-2xl bg-white/80 p-2.5 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur">
        <button

          type="button"
          onClick={() => cinemaRef.current()}
          aria-pressed={cinema}
          className="rounded-full bg-sunny px-3.5 py-2.5 text-[12.5px] font-bold text-sunny-foreground shadow-[0_3px_0_var(--sunny-shadow)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--sunny-shadow)]"
        >
          🎥 {cinema ? "Vue libre" : "Vue cinéma"}
        </button>
        <div className="relative" data-drive-menu>
          <button
            type="button"
            disabled={driveState === "saving" || loadState === "loading"}
            onClick={() => setDriveMenuOpen((v) => !v)}
            aria-expanded={driveMenuOpen}
            className="rounded-full bg-ink/10 px-3 py-2.5 text-[12.5px] font-bold text-ink transition-transform active:translate-y-0.5 disabled:opacity-60"
          >
            ☁️ Drive
          </button>
          {driveMenuOpen && (
            <div className="absolute bottom-full right-0 mb-2 flex w-44 flex-col gap-1.5 rounded-2xl bg-white/95 p-2 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur">
              <button
                type="button"
                disabled={driveState === "saving" || loadState === "loading"}
                onClick={handleSaveToDrive}
                className="flex items-center justify-between rounded-xl bg-ink/5 px-3 py-2 text-left text-[12.5px] font-semibold text-ink transition-colors active:bg-ink/10 disabled:opacity-60"
              >
                <span>
                  {driveState === "saving"
                    ? "⏳ Envoi..."
                    : driveState === "done"
                      ? "✅ Sauvé"
                      : driveState === "error"
                        ? "⚠️ Réessayer"
                        : "☁️ Sauvegarder"}
                </span>
              </button>
              <button
                type="button"
                disabled={loadState === "loading" || driveState === "saving"}
                onClick={handleLoadFromDrive}
                className="flex items-center justify-between rounded-xl bg-ink/5 px-3 py-2 text-left text-[12.5px] font-semibold text-ink transition-colors active:bg-ink/10 disabled:opacity-60"
              >
                <span>
                  {loadState === "loading"
                    ? "⏳ Lecture..."
                    : loadState === "done"
                      ? "✅ Chargé"
                      : loadState === "error"
                        ? "⚠️ Réessayer"
                        : "📥 Charger"}
                </span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Mode construction : palette de pièces à poser sur la grille */}
      <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(94vw,560px)] -translate-x-1/2 flex-col items-center gap-2">
        <button
          type="button"
          onClick={toggleBuild}
          aria-pressed={buildMode}
          className={`rounded-full px-4 py-2.5 text-[12.5px] font-bold shadow-[0_6px_20px_rgba(6,58,94,0.18)] transition-transform active:translate-y-0.5 ${
            buildMode ? "bg-splash text-splash-foreground" : "bg-white/90 text-ink"
          }`}
        >
          🏗️ {buildMode ? "Quitter la construction" : "Construire"}
        </button>
        {buildMode && (
          <div className="flex w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-white/90 p-2 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur">
            {(
              [
                "straight",
                "bend",
                "intersection",
                "crossroad",
                "light",
                "lamp",
                "erase",
              ] as BuildTool[]
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => chooseTool(t)}
                aria-pressed={tool === t}
                className={`rounded-xl px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
                  tool === t ? "bg-splash text-splash-foreground" : "bg-ink/10 text-ink"
                }`}
              >
                {TOOL_LABEL[t]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const next = (rotRef.current + 1) % 4;
                rotRef.current = next;
                setRot(next);
              }}
              className="rounded-xl bg-sunny px-2.5 py-1.5 text-[11.5px] font-bold text-sunny-foreground"
            >
              🔄 {rot * 90}°
            </button>
          </div>
        )}
      </div>
    </>

  );
}
