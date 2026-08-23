import { useEffect, useRef, useState } from "react";
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
  const spawnRef = useRef<() => void>(() => {});
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
    scene.fog = new THREE.Fog(0xd9eefb, 220, 700);

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

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );
    camera.position.set(-34, 26, WASH_SITE_Z + 40);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(2, 1.5, WASH_SITE_Z + 6);
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

    const findWheels = (car: THREE.Object3D) => {
      const wheels: THREE.Object3D[] = [];
      car.traverse((n) => {
        if (n.name && n.name.toLowerCase().includes("wheel")) wheels.push(n);
      });
      return wheels;
    };

    const makeBrush = () => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 1.7, 10),
        new THREE.MeshStandardMaterial({ color: 0x333333 }),
      );
      core.castShadow = true;
      g.add(core);

      const bristleColors = [0x1fb6ff, 0xff5b5b, 0x1fb6ff, 0xffe14d];
      const bristleCount = 40;
      const bristleGeo = new THREE.BoxGeometry(0.045, 0.045, 0.42);
      for (let i = 0; i < bristleCount; i++) {
        const mat = new THREE.MeshStandardMaterial({
          color: bristleColors[i % bristleColors.length]!,
          roughness: 0.9,
        });
        const b = new THREE.Mesh(bristleGeo, mat);
        const t = (i / bristleCount) * Math.PI * 2;
        const yPos = -0.8 + (i / bristleCount) * 1.6;
        b.position.set(Math.cos(t) * 0.14, yPos, Math.sin(t) * 0.14);
        b.lookAt(new THREE.Vector3(0, yPos, 0));
        b.translateZ(0.2);
        g.add(b);
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

      // Chaîne de montagnes lointaine, sur tout l'horizon
      for (let i = 0; i < 54; i++) {
        const a = (i / 54) * Math.PI * 2 + rand() * 0.05;
        const r = 250 + rand() * 130;
        const h = 42 + rand() * 78;
        const rad = h * (0.55 + rand() * 0.3);
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(rad, h, 5 + Math.floor(rand() * 3), 1),
          rand() > 0.5 ? rockMat : rockDark,
        );
        m.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r);
        m.rotation.y = rand() * Math.PI;
        scene.add(m);
        if (h > 80) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.34, h * 0.24, 6, 1), snowMat);
          cap.position.set(m.position.x, h - h * 0.12 - 3, m.position.z);
          cap.rotation.y = m.rotation.y;
          scene.add(cap);
        }
      }

      // Collines verdoyantes en avant-plan des montagnes
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * Math.PI * 2 + rand() * 0.12;
        const r = 175 + rand() * 70;
        const h = 8 + rand() * 22;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        // on dégage la vallée du lac
        if (Math.hypot(x + 62, z - 34) < 110) continue;
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(h * 1.9, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
          rand() > 0.5 ? hillMat : hillMat2,
        );
        m.scale.y = 0.42 + rand() * 0.3;
        m.position.set(x, -1, z);
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

    let spawnIndex = 0;
    const spawnSedan = () => {
      const template = kitCar(spawnIndex++ * 3 + 1);
      if (!template) return;
      const sedan = template.clone(true);
      setShadow(sedan);
      const baseY = 0;
      const start = posAt(0);
      sedan.position.set(start.x, baseY, start.z);
      tintCar(sedan, 1);
      scene.add(sedan);
      washCars.push({
        car: sedan,
        d: 0,
        speed: 5.2,
        yaw: 0,
        baseY,
        wheels: findWheels(sedan),
      });
    };

    spawnRef.current = spawnSedan;





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

      // Palette pastel variée pour éviter des immeubles tous identiques
      const PASTELS = [
        0xffc2d1, 0xffe0b2, 0xd7c3f2, 0xc8e6c9, 0xffe9a8, 0xbfe3f0,
        0xf6d5c0, 0xe3d5ff, 0xd5f0dc, 0xffd6a5,
      ];
      const tint = new THREE.Color(
        PASTELS[Math.abs(Math.round(x * 7 + z * 13)) % PASTELS.length],
      );
      const tinted = new Map<THREE.Material, THREE.MeshStandardMaterial>();
      g.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.transparent || mat.name === "glass") return;
        let cloned = tinted.get(mat);
        if (!cloned) {
          cloned = mat.clone();
          cloned.color.lerp(tint, 0.75).multiplyScalar(1.15);
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

      spawnSedan();

      // ----- Ville : grille de rues régulière -----
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

      const xMin = X_STREETS[0]!;
      const xMax = X_STREETS[X_STREETS.length - 1]!;
      const zMin = Z_STREETS[0]!;
      const zMax = Z_STREETS[Z_STREETS.length - 1]!;

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

      /* ----- Chaussées : vraies tuiles du kit Kenney city-kit-roads -----
         Une tuile = 1 unité de kit, mise à l'échelle sur la largeur de rue. */
      const dashGeoX = new THREE.PlaneGeometry(1.4, 0.16);
      const nearCross = (v: number, list: number[]) =>
        list.some((c) => Math.abs(v - c) < STREET_W / 2 + 1);

      const roadTile = (name: string, x: number, z: number, rotY: number) => {
        const tpl = kit[name];
        if (!tpl) return;
        const t = tpl.clone(true);
        t.scale.setScalar(TILE);
        t.position.set(x, 0.012, z);
        t.rotation.y = rotY;
        t.traverse((n) => {
          const m = n as THREE.Mesh;
          if (m.isMesh) m.receiveShadow = true;
        });
        scene.add(t);
      };
      const onStreetX = (x: number) => X_STREETS.some((c) => Math.abs(c - x) < 0.01);
      const onStreetZ = (z: number) => Z_STREETS.some((c) => Math.abs(c - z) < 0.01);

      Z_STREETS.forEach((z) => {
        for (let x = xMin; x <= xMax; x += TILE) {
          if (onStreetX(x)) continue;
          roadTile("road-straight", x, z, Math.PI / 2);
        }
      });
      X_STREETS.forEach((x) => {
        for (let z = zMin; z <= zMax; z += TILE) {
          if (onStreetZ(z)) continue;
          roadTile("road-straight", x, z, 0);
        }
      });
      // Carrefours du quadrillage
      X_STREETS.forEach((x) => {
        Z_STREETS.forEach((z) => {
          roadTile("road-crossroad", x, z, 0);
        });
      });
      // Voie d'accès au car wash, dans le même style
      for (let z = zMin - TILE; z >= WASH_SITE_Z; z -= TILE) {
        roadTile("road-straight", WASH_ACCESS_X, z, 0);
      }


      // ----- Bâtiments Kenney : un par parcelle, hauteurs cohérentes -----
      const blockCentersX: number[] = [];
      for (let i = 0; i < X_STREETS.length - 1; i++) {
        blockCentersX.push((X_STREETS[i]! + X_STREETS[i + 1]!) / 2);
      }
      const blockCentersZ: number[] = [];
      for (let i = 0; i < Z_STREETS.length - 1; i++) {
        blockCentersZ.push((Z_STREETS[i]! + Z_STREETS[i + 1]!) / 2);
      }

      const lawnMat = new THREE.MeshStandardMaterial({ color: 0x7fc76b, roughness: 1 });
      const pavingMat = new THREE.MeshStandardMaterial({ color: 0xded7c4, roughness: 1 });

      /* Deux îlots sortent du moule : un parc avec bassin, une place pavée. */
      const PARK = { x: blockCentersX[1]!, z: blockCentersZ[2]! };
      const PLAZA = { x: blockCentersX[3]!, z: blockCentersZ[1]! };
      const isSpecial = (x: number, z: number) =>
        (x === PARK.x && z === PARK.z) || (x === PLAZA.x && z === PLAZA.z);

      const buildPark = (cx: number, cz: number) => {
        // allées diagonales en croix sur la pelouse
        [-1, 1].forEach((s) => {
          const path = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.5), pavingMat);
          path.rotation.x = -Math.PI / 2;
          path.rotation.z = (s * Math.PI) / 4;
          path.position.set(cx, 0.02, cz);
          path.receiveShadow = true;
          scene.add(path);
        });
        // bassin
        const pond = new THREE.Mesh(
          new THREE.CircleGeometry(1.9, 28),
          new THREE.MeshStandardMaterial({
            color: 0x3fa9d8,
            roughness: 0.15,
            metalness: 0.35,
          }),
        );
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(cx, 0.06, cz);
        scene.add(pond);
        pondSurface = pond;
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(2.0, 0.16, 8, 28),
          new THREE.MeshStandardMaterial({ color: 0xcfc7ae, roughness: 1 }),
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(cx, 0.16, cz);
        setShadow(rim);
        scene.add(rim);
        // arbres en couronne
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          const tr = makeTree();
          tr.position.set(cx + Math.cos(a) * 4, 0, cz + Math.sin(a) * 4);
          tr.scale.setScalar(0.8 + (i % 3) * 0.08);
          setShadow(tr);
          scene.add(tr);
        }
      };

      const buildPlaza = (cx: number, cz: number) => {
        addSlab(pavingMat, 11, 11, cx, cz, 0.015);
        // fontaine centrale
        const basin = new THREE.Mesh(
          new THREE.CylinderGeometry(2.1, 2.3, 0.6, 20),
          new THREE.MeshStandardMaterial({ color: 0xe6e0cd, roughness: 0.9 }),
        );
        basin.position.set(cx, 0.3, cz);
        setShadow(basin);
        scene.add(basin);
        const jet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.3, 2.2, 10),
          new THREE.MeshStandardMaterial({
            color: 0x9fdcf5,
            transparent: true,
            opacity: 0.75,
          }),
        );
        jet.position.set(cx, 1.5, cz);
        scene.add(jet);
        // arbres et coins verts
        [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].forEach(([sx, sz]) => {
          const tr = makeTree();
          tr.position.set(cx + sx! * 4.2, 0, cz + sz! * 4.2);
          tr.scale.setScalar(0.85);
          setShadow(tr);
          scene.add(tr);
        });
      };

      blockCentersX.forEach((bx, ix) => {
        blockCentersZ.forEach((bz, iz) => {
          // pelouse du pâté de maisons (entre les trottoirs)
          addSlab(lawnMat, 12 - STREET_W, 12 - STREET_W, bx, bz, 0.01);

          if (bx === PARK.x && bz === PARK.z) {
            buildPark(bx, bz);
            return;
          }
          if (bx === PLAZA.x && bz === PLAZA.z) {
            buildPlaza(bx, bz);
            return;
          }

          // anneau : 0 = centre-ville, 2 = périphérie pavillonnaire
          const ring = Math.max(Math.abs(bx) / 12, Math.abs(bz) / 12);
          let floors: number;
          if (ring < 1.2) floors = 4 - ((ix + iz) % 2);
          else if (ring < 1.8) floors = 2 + ((ix + iz) % 2);
          else floors = 1;
          buildKenneyBuilding(bx, bz, 2, 2, floors, bz > 0 ? Math.PI : 0);
        });
      });


      // Arbres alignés le long des trottoirs, un sur deux entre carrefours
      Z_STREETS.forEach((z, zi) => {
        for (let x = xMin + 3; x <= xMax - 3; x += 6) {
          if (nearCross(x, X_STREETS)) continue;
          [-1, 1].forEach((side) => {
            const tr = makeTree();
            tr.position.set(x, 0, z + side * (STREET_W / 2 + 1.1));
            tr.scale.setScalar(0.85 + ((zi + x) % 3) * 0.06);
            setShadow(tr);
            scene.add(tr);
          });
        }
      });
      // Rangées d'arbres au cœur des îlots verts
      for (let xi = 0; xi < X_STREETS.length - 1; xi++) {
        for (let zi = 0; zi < Z_STREETS.length - 1; zi++) {
          if ((xi + zi) % 2 === 0) continue;
          const bx = (X_STREETS[xi]! + X_STREETS[xi + 1]!) / 2;
          const bz = (Z_STREETS[zi]! + Z_STREETS[zi + 1]!) / 2;
          if (isSpecial(bx, bz)) continue;
          [-1, 1].forEach((s) => {
            const tr = makeTree();
            tr.position.set(bx + s * 2.4, 0, bz + s * 2.4);
            tr.scale.setScalar(0.75);
            setShadow(tr);
            scene.add(tr);
          });
        }
      }


      /* Mobilier urbain 100 % Kenney, posé sur une grille stricte :
         feux aux carrefours majeurs, lampadaires et bennes en bord de bloc. */
      const CURB_OFFSET = STREET_W / 2 + 0.45;
      const signalX = X_STREETS.filter((_, i) => i % 2 === 1);
      const signalZ = Z_STREETS.filter((_, i) => i % 2 === 1);
      signalX.forEach((cx) => {
        signalZ.forEach((cz) => {
          const corners: Array<{ x: number; z: number; axis: "x" | "z" }> = [
            { x: cx - CURB_OFFSET, z: cz - CURB_OFFSET, axis: "x" },
            { x: cx + CURB_OFFSET, z: cz + CURB_OFFSET, axis: "z" },
          ];
          corners.forEach(({ x, z, axis }) => {
            const light = makeTrafficLight(axis);
            light.position.set(x, 0, z);
            light.rotation.y = Math.atan2(cx - x, cz - z);
            setShadow(light);
            scene.add(light);
          });
        });
      });

      const FURNITURE_OFFSET = STREET_W / 2 + 0.6;
      const placeKit = (
        name: string,
        x: number,
        z: number,
        rotY: number,
        scale = 6,
      ) => {
        const tpl = kit[name];
        if (!tpl) return;
        const inst = tpl.clone(true);
        inst.scale.setScalar(scale);
        inst.position.set(x, 0, z);
        inst.rotation.y = rotY;
        setShadow(inst);
        scene.add(inst);
      };

      for (let xi = 0; xi < X_STREETS.length - 1; xi++) {
        for (let zi = 0; zi < Z_STREETS.length - 1; zi++) {
          const bx = (X_STREETS[xi]! + X_STREETS[xi + 1]!) / 2;
          const southStreet = Z_STREETS[zi]!;
          const northStreet = Z_STREETS[zi + 1]!;

          // lampadaires alternés de part et d'autre du bloc
          placeKit("light-square", bx - 2, southStreet + FURNITURE_OFFSET, Math.PI);
          placeKit("light-square", bx + 2, northStreet - FURNITURE_OFFSET, 0);

          // bennes et panneaux de rue, un bloc sur deux
          if ((xi + zi) % 2 === 0) {
            placeKit("dumpster", bx + 2.4, southStreet + FURNITURE_OFFSET, Math.PI / 2, 6);
          } else {
            placeKit("road-sign-street", bx - 2.4, northStreet - FURNITURE_OFFSET, 0, 6);
          }
        }
      }




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

      // Arbres en bordure de parcelle, pour séparer la station de la ville
      for (let x = -17; x <= 17; x += 5) {
        const tr = makeTree();
        tr.position.set(x, 0, WASH_SITE_Z + 12);
        tr.scale.setScalar(0.9);
        setShadow(tr);
        scene.add(tr);

      }

      // ----- Circulation : deux voies par rue, sens opposés, bien centrées -----
      let ti = 0;
      const addTraffic = (
        axis: "x" | "z",
        lane: number,
        dir: number,
        s: number,
      ) => {
        const car = kitCar(ti).clone(true);
        setShadow(car);
        scene.add(car);
        // modèles Kenney : le nez pointe vers +Z
        const heading =
          axis === "x" ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
        /* on ne circule que sur la chaussée : bornes = extrémités de la rue */
        const sMin = axis === "x" ? xMin : zMin;
        const sMax = axis === "x" ? xMax : zMax;
        trafficCars.push({
          car,
          axis,
          lane,
          s: Math.min(Math.max(s, sMin), sMax),
          dir,
          speed: 3.4 + (ti % 3) * 0.5,
          heading,
          yaw: 0,
          baseY: 0,
          wheels: findWheels(car),
          sMin,
          sMax,
        });



        ti++;
      };

      Z_STREETS.forEach((z, i) => {
        addTraffic("x", z + LANE, 1, xMin + ((i * 11) % 40));
        addTraffic("x", z - LANE, -1, xMin + ((i * 17) % 40));
      });
      X_STREETS.forEach((x, i) => {
        if (i % 2 !== 0) return;
        addTraffic("z", x - LANE, 1, zMin + ((i * 13) % 34));
        addTraffic("z", x + LANE, -1, zMin + ((i * 7) % 34));
      });
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
      const BELT_SPEED = ctl.belt ? 1.1 : 0;
      const GAP = 3.2;
      const [zoneStart, zoneEnd] = WASH_ZONE;

      // Les voitures suivent l'itinéraire routier ; la première est en tête
      let aheadD = Number.POSITIVE_INFINITY;
      const occupied = washCars.some((c) => c.d > WASH_D0 - 0.2 && c.d < WASH_D1);

      for (let i = 0; i < washCars.length; i++) {
        const e = washCars[i]!;
        const onBelt = e.d >= WASH_D0 && e.d <= WASH_D1;
        const wantSpeed = onBelt ? BELT_SPEED : e.speed;

        // Limite : garder une distance de sécurité avec la voiture devant
        let limit = aheadD - GAP;
        // Portail d'entrée : on attend que le tunnel se libère
        if (!onBelt && e.d < WASH_D0 && occupied) {
          limit = Math.min(limit, WASH_D0 - 0.6);
        }

        const target = Math.min(e.d + dt * wantSpeed, limit);
        const moved = Math.max(target - e.d, 0);
        e.d += moved;

        e.wheels.forEach((w) => {
          w.rotation.x -= (moved / 0.35) * 2;
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

      for (let i = washCars.length - 1; i >= 0; i--) {
        const e = washCars[i]!;
        if (e.d >= ROUTE_LEN - 0.05) {
          scene.remove(e.car);
          washCars.splice(i, 1);
        }
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

      /* Circulation : voitures strictement sur la chaussée, à distance de la
         voiture de devant, et cycle de feux rouge/vert aux carrefours.
         Phase 0 : rues Est-Ouest au vert. Phase 1 : rues Nord-Sud au vert. */
      const CAR_GAP = 4.2;
      const LIGHT_CYCLE = 9; // secondes par phase
      const phase = Math.floor(t / LIGHT_CYCLE) % 2;
      const greenAxis: "x" | "z" = phase === 0 ? "x" : "z";
      const HALF_CROSS = STREET_W / 2 + 0.6;
      trafficCars.forEach((e) => {
        if (!ctl.traffic) return;
        const step = dt * e.speed;
        const nextS = e.s + step * e.dir;

        // 1) distance de sécurité avec la voiture devant, même rue même voie
        let blocked = false;
        for (const o of trafficCars) {
          if (o === e || o.axis !== e.axis) continue;
          if (Math.abs(o.lane - e.lane) > 0.5) continue;
          const ahead = (o.s - nextS) * e.dir;
          if (ahead > 0 && ahead < CAR_GAP) {
            blocked = true;
            break;
          }
        }

        // 2) feu rouge : on s'arrête AVANT le carrefour, jamais dedans
        if (!blocked && e.axis !== greenAxis) {
          const crossings = e.axis === "x" ? X_STREETS : Z_STREETS;
          for (const c of crossings) {
            const distNow = (c - e.s) * e.dir;
            const distNext = (c - nextS) * e.dir;
            // déjà engagé dans le carrefour : on le dégage toujours
            if (Math.abs(e.s - c) <= HALF_CROSS) continue;
            // la ligne d'arrêt est à HALF_CROSS avant le centre du carrefour
            if (distNow > HALF_CROSS && distNext <= HALF_CROSS) {
              blocked = true;
              break;
            }
          }
        }

        if (blocked) return;

        e.s = nextS;
        // bouclage strictement dans les limites de la chaussée
        if (e.s > e.sMax) e.s = e.sMin;
        if (e.s < e.sMin) e.s = e.sMax;
        // roues qui tournent proportionnellement à la distance parcourue
        e.wheels.forEach((w) => {
          w.rotation.x -= (step / 0.35) * 2;
        });
      });

      trafficCars.forEach((e) => {
        if (e.axis === "x") e.car.position.set(e.s, e.baseY, e.lane);
        else e.car.position.set(e.lane, e.baseY, e.s);
        e.car.rotation.y = e.heading + e.yaw;
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



    // File d'attente : de nouvelles voitures arrivent régulièrement
    let queueTimer = 0;

    loadAll()
      .then(() => {
        if (disposed) return;
        buildScene();
        setLoading(false);
        animate();
        queueTimer = window.setInterval(() => {
          if (washCars.length < 5) spawnSedan();
        }, 4000);

        void loadMeshy();
      })
      .catch((err: unknown) => {
        console.error(err);
        setMessage("Oups, un modèle n'a pas pu charger.");
      });


    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearInterval(queueTimer);
      window.removeEventListener("resize", onResize);
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

      <div className="pointer-events-none fixed left-4 top-4 max-w-[280px] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,.6)]">
        <p className="flex items-center gap-2 text-[22px] font-bold tracking-wide">
          <span aria-hidden>🫧</span> TikowikoCarWash
        </p>

        <p className="mt-1 text-[12.5px] leading-relaxed opacity-85">
          Construit avec les kits Kenney (voitures, routes, bâtiments). Glisse pour tourner la
          caméra, molette pour zoomer.
        </p>
      </div>

      <div className="pointer-events-none fixed bottom-4 left-4 text-[11.5px] text-ink opacity-75 drop-shadow-[0_1px_0_rgba(255,255,255,.6)]">
        <p>🖱️ Glisser = tourner • Molette = zoomer • Clic droit = déplacer</p>
        <p className="mt-1 opacity-80">Modèles Kenney (kenney.nl) — licence CC0</p>
        <p className="mt-1 font-semibold opacity-90">© {new Date().getFullYear()} tikowikoFamily</p>

      </div>

      <div className="fixed right-4 top-4 w-[190px] rounded-2xl bg-white/80 p-3 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur">
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
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-colors ${
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


      <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-2xl bg-white/80 p-2.5 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur">
        <button
          type="button"
          onClick={() => spawnRef.current()}
          className="rounded-full bg-splash px-3.5 py-2.5 text-[12.5px] font-bold text-splash-foreground shadow-[0_3px_0_var(--splash-shadow)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--splash-shadow)]"
        >
          🚗 Envoyer une voiture
        </button>
        <button
          type="button"
          onClick={() => cinemaRef.current()}
          aria-pressed={cinema}
          className="rounded-full bg-sunny px-3.5 py-2.5 text-[12.5px] font-bold text-sunny-foreground shadow-[0_3px_0_var(--sunny-shadow)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--sunny-shadow)]"
        >
          🎥 {cinema ? "Vue libre" : "Vue cinéma"}
        </button>
      </div>
    </>
  );
}
