import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveToDrive, loadFromDrive } from "@/lib/drive.functions";

const SAVE_VERSION = 1;


import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import modelsAsset from "@/assets/car-wash-models.json.asset.json";

import tunnelAsset from "@/assets/tunnel.glb.asset.json";
import kenneyPackAsset from "@/assets/kenney-pack.glb.asset.json";

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
  const toggleMachine = (key: keyof typeof machines) => {
    setMachines((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      machinesRef.current = next;
      return next;
    });
  };

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
    let pondSurface: THREE.Mesh | null = null;

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
    else camera.position.set(-34, 26, WASH_SITE_Z + 40);


    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(isPortrait() ? -4 : 2, 1.5, WASH_SITE_Z + (isPortrait() ? 12 : 6));
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
      /* voiture de ville empruntée : elle retourne circuler après le lavage */
      origin: TrafficCar;
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
    type TrafficCar = {
      car: THREE.Object3D;
      axis: "x" | "z";
      /* coordonnée fixe = centre de la voie */
      lane: number;
      /* position le long de la rue */
      s: number;
      dir: number;
      speed: number;
      heading: number;
      yaw: number;
      baseY: number;
      wheels: THREE.Object3D[];
      /* bornes de la chaussée pour cet axe : jamais de sortie sur la pelouse */
      sMin: number;
      sMax: number;

    };

    const trafficCars: TrafficCar[] = [];
    /* Toute la station de lavage (tunnel, tapis, brosses, voitures à laver)
       vit dans ce groupe : ses coordonnées locales restent inchangées. */
    const washSite = new THREE.Group();
    washSite.position.z = WASH_SITE_Z;
    scene.add(washSite);
    /* Portique de lavage provisoire (Kenney) remplacé par le modèle Meshy
       détaillé dès qu'il est chargé. */
    let tunnelPlaceholder: THREE.Object3D | null = null;



    /* ----- Itinéraire routier complet : ville → voie d'accès → tunnel → retour ----- */
    const CITY_SOUTH = -24; // rue la plus au sud de la grille
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

    /* Une voiture de la ville décide spontanément d'aller au lavage : elle
       quitte la circulation, suit l'itinéraire jusqu'au tunnel, puis revient
       rouler en ville une fois propre. */
    let washCooldown = 6 + Math.random() * 6;
    const sendCityCarToWash = () => {
      if (trafficCars.length <= 4) return;
      const idx = Math.floor(Math.random() * trafficCars.length);
      const origin = trafficCars.splice(idx, 1)[0];
      if (!origin) return;
      const start = posAt(0);
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

    /* Bâtiments assemblés avec le kit maison Kenney (dalles, murs à fenêtres,
       toitures) : ils gardent la texture « colormap » d'origine. */
    const CELL = 2; // taille d'une dalle hFloor
    const FLOOR_H = 2.4; // hauteur d'un mur hWallWindow

    const buildKenneyBuilding = (
      x: number,
      z: number,
      cols: number,
      rows: number,
      floors: number,
      rotY = 0,
    ) => {
      const g = new THREE.Group();
      const floorTpl = kit["floor"] ?? models["hFloor"]!;
      const wallTpl = kit["wall-window-square"] ?? models["hWallWindow"]!;
      const roofTpl = kit["roof-flat-center"] ?? floorTpl;
      const doorTpl = kit["wall-doorway-square"] ?? wallTpl;

      const ox = (-(cols - 1) * CELL) / 2;
      const oz = (-(rows - 1) * CELL) / 2;

      for (let f = 0; f < floors; f++) {
        const y = f * FLOOR_H;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const cx = ox + i * CELL;
            const cz = oz + j * CELL;
            const slab = floorTpl.clone(true);
            slab.position.set(cx, y, cz);
            g.add(slab);

            const wall = (wx: number, wz: number, wr: number, door = false) => {
              const w = (door ? doorTpl : wallTpl).clone(true);
              w.position.set(wx, y, wz);
              w.rotation.y = wr;
              g.add(w);
            };
            if (i === 0) wall(cx - CELL / 2, cz, 0);
            if (i === cols - 1) wall(cx + CELL / 2, cz, 0);
            if (j === 0) wall(cx, cz - CELL / 2, Math.PI / 2, f === 0 && i === 0);
            if (j === rows - 1) wall(cx, cz + CELL / 2, Math.PI / 2);

          }
        }
      }

      // Toiture : dalles pleines, sans trou
      const top = floors * FLOOR_H;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const deck = roofTpl.clone(true);
          deck.position.set(ox + i * CELL, top, oz + j * CELL);
          g.add(deck);
        }
      }

      /* Palette pastel variée : hash pseudo-aléatoire sur la position pour
         que deux immeubles voisins n'aient jamais la même teinte (l'ancienne
         formule linéaire retombait toujours sur les mêmes indices). */
      const PASTELS = [
        0xffb3c6, 0xffd39b, 0xc9a7f0, 0xa8e6a3, 0xffe066, 0x9fd8ef,
        0xf7b267, 0xb8b3f0, 0x8fd6b4, 0xffa987, 0xf2e2c4, 0xe58fb0,
      ];
      const hash = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
      const tint = new THREE.Color(
        PASTELS[Math.floor(hash * PASTELS.length) % PASTELS.length],
      );
      // légère variation de luminosité en plus de la teinte
      const bright = 1.02 + ((Math.abs(Math.sin(x * 3.17 + z * 5.11)) * 100) % 1) * 0.22;
      const tinted = new Map<THREE.Material, THREE.MeshStandardMaterial>();
      g.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.transparent || mat.name === "glass") return;
        let cloned = tinted.get(mat);
        if (!cloned) {
          cloned = mat.clone();
          cloned.color.lerp(tint, 0.9).multiplyScalar(bright);
          tinted.set(mat, cloned);
        }
        mesh.material = cloned;
      });



      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      setShadow(g);
      scene.add(g);
    };


    // Grille de rues régulière (rues nord-sud et est-ouest)
    const X_STREETS = [-30, -18, -6, 6, 18, 30];
    const Z_STREETS = [-24, -12, 0, 12, 24];
    const STREET_W = 6; // = une tuile de route Kenney mise à l'échelle
    const TILE = 6;
    const LANE = 1.5;


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
      if (pondSurface) pondSurface.position.y = 0.06 + Math.sin(t * 1.1 + 1) * 0.025;


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
          <span aria-hidden>🫧</span> TikowikoCarWash
        </p>

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

    </>
  );
}
