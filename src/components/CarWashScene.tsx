import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import modelsAsset from "@/assets/car-wash-models.json.asset.json";

import blueSuvAsset from "@/assets/blue_suv.glb.asset.json";
import graySedanAsset from "@/assets/gray_sedan.glb.asset.json";
import greenSportsAsset from "@/assets/green_sports.glb.asset.json";
import yellowPickupAsset from "@/assets/yellow_pickup.glb.asset.json";


const MESHY_CARS = [blueSuvAsset, graySedanAsset, greenSportsAsset, yellowPickupAsset];

/* Les voitures Meshy sont normalisées le long de +X ; ce décalage aligne
   l'avant (capot) sur le sens de marche. */
const MESHY_YAW = Math.PI / 2;



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
const CAR_Y = 0.3;
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

    /* GLTFLoader décode les textures via ImageBitmapLoader (fetch), ce que
       l'iframe de prévisualisation peut bloquer : on force le décodage <img>. */
    (window as unknown as { createImageBitmap?: unknown }).createImageBitmap = undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xbfe8ff, 40, 95);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      300,
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
    controls.maxDistance = 110;
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
      new THREE.PlaneGeometry(240, 240),
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

    /* ---------- Mobilier urbain ---------- */
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3d4249, roughness: 0.7 });

    const makeLamp = () => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 8), poleMat);
      pole.position.y = 1.8;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), poleMat);
      arm.position.set(0.45, 3.55, 0);
      g.add(arm);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.14, 0.28),
        new THREE.MeshStandardMaterial({
          color: 0xfff4c2,
          emissive: 0xffe58a,
          emissiveIntensity: 0.5,
        }),
      );
      head.position.set(0.85, 3.46, 0);
      g.add(head);
      return g;
    };

    const makeBench = () => {
      const g = new THREE.Group();
      const woodMat = new THREE.MeshStandardMaterial({ color: 0xa9713f, roughness: 0.9 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.55), woodMat);
      seat.position.y = 0.45;
      g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.09), woodMat);
      back.position.set(0, 0.72, -0.24);
      g.add(back);
      [-0.7, 0.7].forEach((x) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.5), poleMat);
        leg.position.set(x, 0.22, 0);
        g.add(leg);
      });
      return g;
    };

    const makeBin = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.22, 0.75, 10),
        new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.85 }),
      );
      body.position.y = 0.38;
      g.add(body);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.08, 10), poleMat);
      lid.position.y = 0.79;
      g.add(lid);
      return g;
    };

    type TrafficLight = { axis: "x" | "z"; red: THREE.Mesh; green: THREE.Mesh };
    const trafficLights: TrafficLight[] = [];

    const makeTrafficLight = (axis: "x" | "z") => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8), poleMat);
      pole.position.y = 1.3;
      g.add(pole);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.3), poleMat);
      box.position.y = 2.9;
      g.add(box);
      const bulb = (color: number, y: number) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 10, 10),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 }),
        );
        m.position.set(0, y, 0.17);
        box.add(m);
        return m;
      };
      const red = bulb(0xff3b30, 0.28);
      bulb(0xffcc00, 0);
      const green = bulb(0x33d17a, -0.28);
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
    const meshyCars: THREE.Object3D[] = [];
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

    const spawnSedan = () => {
      const template =
        meshyCars.length > 0
          ? meshyCars[Math.floor(Math.random() * meshyCars.length)]!
          : models["sedan"];
      if (!template) return;
      const sedan = template.clone(true);
      setShadow(sedan);
      const isKenney = template === models["sedan"];
      const baseY = isKenney ? CAR_Y : 0.06;
      const start = posAt(0);
      sedan.position.set(start.x, baseY, start.z);
      tintCar(sedan, 1);
      scene.add(sedan);
      washCars.push({
        car: sedan,
        d: 0,
        speed: 5.2,
        yaw: isKenney ? 0 : MESHY_YAW,
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
      const floorTpl = models["hFloor"]!;
      const wallTpl = models["hWallWindow"]!;
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

            const wall = (wx: number, wz: number, wr: number) => {
              const w = wallTpl.clone(true);
              w.position.set(wx, y, wz);
              w.rotation.y = wr;
              g.add(w);
            };
            if (i === 0) wall(cx - CELL / 2, cz, 0);
            if (i === cols - 1) wall(cx + CELL / 2, cz, 0);
            if (j === 0) wall(cx, cz - CELL / 2, Math.PI / 2);
            if (j === rows - 1) wall(cx, cz + CELL / 2, Math.PI / 2);
          }
        }
      }

      // Toiture : dalles pleines, sans trou
      const top = floors * FLOOR_H;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const deck = floorTpl.clone(true);
          deck.position.set(ox + i * CELL, top, oz + j * CELL);
          g.add(deck);
        }
      }

      // Légère variation de teinte pour éviter des immeubles tous identiques
      const tint = new THREE.Color().setHSL(
        (Math.abs(x * 7 + z * 13) % 100) / 100,
        0.18,
        0.62,
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
          cloned.color.multiply(tint).multiplyScalar(1.5);
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
    const STREET_W = 5;
    const LANE = 1.25;

    const buildScene = () => {


      const tunnel = models["tunnel"]!.clone(true);
      tunnel.rotation.y = Math.PI / 2;
      tunnel.position.set(2, 0, 0);
      setShadow(tunnel);
      washSite.add(tunnel);


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
          spin.scale.set(1.25, 1.15, 1.25);
          pivot.add(spin);
          pivot.position.set(WASH_ZONE[0] + offset, ROAD_Y + 1.1, zSide * 1.45);
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
        spin.scale.set(1.1, 1.5, 1.1);
        pivot.add(spin);
        pivot.position.set(x, ROAD_Y + 2.1, 0);
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
      const spanX = xMax - xMin + STREET_W;
      const spanZ = zMax - zMin + STREET_W;

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

      // Trottoirs (légèrement plus larges que la chaussée) puis chaussée
      Z_STREETS.forEach((z) => {
        addSlab(sidewalkMat, spanX, STREET_W + 1.2, 0, z, 0.005);
      });
      X_STREETS.forEach((x) => {
        addSlab(sidewalkMat, STREET_W + 1.2, spanZ, x, 0, 0.005);
      });
      Z_STREETS.forEach((z) => {
        addSlab(asphalt, spanX, STREET_W, 0, z, 0.02);
      });
      X_STREETS.forEach((x) => {
        addSlab(asphalt, STREET_W, spanZ, x, 0, 0.02);
      });

      // Ligne axiale discontinue (interrompue aux carrefours)
      const dashGeoX = new THREE.PlaneGeometry(1.4, 0.16);
      const nearCross = (v: number, list: number[]) =>
        list.some((c) => Math.abs(v - c) < STREET_W / 2 + 1);
      Z_STREETS.forEach((z) => {
        for (let x = xMin - STREET_W / 2 + 1; x < xMax + STREET_W / 2; x += 3) {
          if (nearCross(x, X_STREETS)) continue;
          const d = new THREE.Mesh(dashGeoX, dashMat);
          d.rotation.x = -Math.PI / 2;
          d.position.set(x, 0.03, z);
          scene.add(d);
        }
      });
      X_STREETS.forEach((x) => {
        for (let z = zMin - STREET_W / 2 + 1; z < zMax + STREET_W / 2; z += 3) {
          if (nearCross(z, Z_STREETS)) continue;
          const d = new THREE.Mesh(dashGeoX, dashMat);
          d.rotation.x = -Math.PI / 2;
          d.rotation.z = Math.PI / 2;
          d.position.set(x, 0.03, z);
          scene.add(d);
        }
      });

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
      blockCentersX.forEach((bx, ix) => {
        blockCentersZ.forEach((bz, iz) => {
          // pelouse du pâté de maisons (entre les trottoirs)
          addSlab(lawnMat, 12 - STREET_W - 1.2, 12 - STREET_W - 1.2, bx, bz, 0.01);

          // anneau : 0 = centre-ville, 2 = périphérie pavillonnaire
          const ring = Math.max(Math.abs(bx) / 12, Math.abs(bz) / 12);
          let floors: number;
          if (ring < 1.2) floors = 4 - ((ix + iz) % 2);
          else if (ring < 1.8) floors = 2 + ((ix + iz) % 2);
          else floors = 1;
          buildKenneyBuilding(bx, bz, 2, 2, floors, bz > 0 ? Math.PI : 0);
        });
      });


      // Arbres réguliers le long des trottoirs
      Z_STREETS.forEach((z, zi) => {
        for (let x = xMin + 3; x <= xMax - 3; x += 6) {
          if (nearCross(x, X_STREETS)) continue;
          [-1, 1].forEach((side) => {
            const tr = makeTree();
            tr.position.set(x, 0, z + side * (STREET_W / 2 + 0.9));
            tr.scale.setScalar(0.85 + ((zi + x) % 3) * 0.06);
            scene.add(tr);
          });
        }
      });

      /* ----- Parcelle dédiée du car wash (périphérie sud) ----- */
      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x9aa0a6,
        roughness: 1,
      });

      // Voie d'accès depuis la rue z = zMin jusqu'à la station
      const accessLen = zMin - WASH_SITE_Z;
      const accessCz = (zMin + WASH_SITE_Z) / 2;
      addSlab(sidewalkMat, STREET_W + 1.2, accessLen, WASH_ACCESS_X, accessCz, 0.005);
      addSlab(asphalt, STREET_W, accessLen, WASH_ACCESS_X, accessCz, 0.02);
      for (let z = zMin - 4; z > WASH_SITE_Z + 3; z -= 3) {
        const d = new THREE.Mesh(dashGeoX, dashMat);
        d.rotation.x = -Math.PI / 2;
        d.rotation.z = Math.PI / 2;
        d.position.set(WASH_ACCESS_X, 0.03, z);
        scene.add(d);
      }

      // Terrain de la station : pelouse + dalle béton
      addSlab(lawnMat, 46, 26, 0, WASH_SITE_Z + 2, 0.008);
      addSlab(concreteMat, 40, 20, 0, WASH_SITE_Z + 3, 0.012);

      // Voie de lavage (traversée est-ouest de la parcelle)
      addSlab(asphalt, 34, STREET_W, 0, WASH_SITE_Z, 0.02);
      for (let x = -16; x <= 16; x += 3) {
        if (x > PATH_START + 2 && x < PATH_END - 2) continue;
        const d = new THREE.Mesh(dashGeoX, dashMat);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.03, WASH_SITE_Z);
        scene.add(d);
      }

      // Parking : 5 places marquées derrière la station
      const parkZ = WASH_SITE_Z + 8.5;
      addSlab(concreteMat, 26, 8, -2, parkZ, 0.016);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.8 });
      for (let i = 0; i <= 5; i++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 6), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(-13 + i * 4.4, 0.024, parkZ);
        scene.add(line);
      }
      // Une voiture garée en attente
      const parked = models["taxi"]!.clone(true);
      setShadow(parked);
      parked.position.set(-10.8, CAR_Y, parkZ);
      scene.add(parked);

      // Arbres en bordure de parcelle, pour séparer la station de la ville
      for (let x = -20; x <= 20; x += 5) {
        const tr = makeTree();
        tr.position.set(x, 0, WASH_SITE_Z + 14);
        tr.scale.setScalar(0.9);
        scene.add(tr);
      }

      // ----- Circulation : deux voies par rue, sens opposés, bien centrées -----
      const cityTemplates = [models["taxi"]!, models["sedan"]!];
      let ti = 0;
      const addTraffic = (
        axis: "x" | "z",
        lane: number,
        dir: number,
        s: number,
      ) => {
        const car = cityTemplates[ti % cityTemplates.length]!.clone(true);
        setShadow(car);
        scene.add(car);
        // modèles Kenney : le nez pointe vers +Z
        const heading =
          axis === "x" ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
        /* on ne circule que sur la chaussée : bornes = extrémités de la rue */
        const sMin = (axis === "x" ? xMin : zMin) - STREET_W / 2;
        const sMax = (axis === "x" ? xMax : zMax) + STREET_W / 2;
        trafficCars.push({
          car,
          axis,
          lane,
          s: Math.min(Math.max(s, sMin), sMax),
          dir,
          speed: 3.4 + (ti % 3) * 0.5,
          heading,
          yaw: 0,
          baseY: CAR_Y,
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

      const ctl = machinesRef.current;
      const SPEED = 2.6;
      const BELT_SPEED = ctl.belt ? 1.1 : 0;
      const GAP = 3.2;
      const [zoneStart, zoneEnd] = WASH_ZONE;

      // La voiture la plus avancée est en tête de file (ordre d'arrivée)
      let aheadX = Number.POSITIVE_INFINITY;
      const occupied = sedanCars.some(
        (c) => c.position.x > zoneStart - 0.2 && c.position.x < zoneEnd,
      );

      for (let i = 0; i < sedanCars.length; i++) {
        const car = sedanCars[i]!;
        const onBelt = car.position.x >= zoneStart && car.position.x <= zoneEnd;
        const wantSpeed = onBelt ? BELT_SPEED : SPEED;

        // Limite : garder une distance de sécurité avec la voiture devant
        let limit = aheadX - GAP;
        // Portail d'entrée : on attend que le tunnel se libère
        if (!onBelt && car.position.x < zoneStart && occupied) {
          limit = Math.min(limit, zoneStart - 0.6);
        }

        const target = Math.min(car.position.x + dt * wantSpeed, limit);
        const moved = Math.max(target - car.position.x, 0);
        car.position.x += moved;
        const waiting = moved < dt * wantSpeed * 0.35;
        car.userData["waiting"] = waiting;

        (car.userData["wheels"] as THREE.Object3D[]).forEach((w) => {
          w.rotation.x -= (moved / 0.35) * 2;
        });

        let dirtiness: number;
        if (car.position.x <= zoneStart) dirtiness = 1;
        else if (car.position.x >= zoneEnd) dirtiness = 0;
        else dirtiness = 1 - (car.position.x - zoneStart) / (zoneEnd - zoneStart);
        tintCar(car, dirtiness);

        const baseY = (car.userData["baseY"] as number | undefined) ?? CAR_Y;
        car.position.y = onBelt ? baseY + 0.14 + Math.sin(t * 30) * 0.012 : baseY;

        aheadX = car.position.x;
      }

      for (let i = sedanCars.length - 1; i >= 0; i--) {
        const car = sedanCars[i]!;
        if (car.position.x > PATH_END) {
          washSite.remove(car);
          sedanCars.splice(i, 1);
        }
      }

      const carInWash = sedanCars.some(
        (c) => c.position.x > zoneStart && c.position.x < zoneEnd,
      );

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
      });

      trafficCars.forEach((e) => {
        if (e.axis === "x") e.car.position.set(e.s, e.baseY, e.lane);
        else e.car.position.set(e.lane, e.baseY, e.s);
        e.car.rotation.y = e.heading + e.yaw;
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

      // Le tunnel de lavage reste le modèle Kenney (le modèle Meshy est abîmé)




      // Véhicules : ajoutés au pool de spawn au fur et à mesure
      const slots: Array<THREE.Group | null> = MESHY_CARS.map(() => null);
      await Promise.all(
        MESHY_CARS.map((asset, i) =>
          load(asset.url)
            .then((raw) => {
              if (disposed) return;
              slots[i] = normalizeModel(raw, 2.4);
            })
            .catch((err: unknown) => console.error("voiture Meshy", err)),
        ),
      );
      slots.forEach((m) => {
        if (m) meshyCars.push(m);
      });
      if (disposed || meshyCars.length === 0) return;

      // Le trafic Kenney est remplacé par les voitures Meshy, variées et bien orientées
      trafficCars.forEach((entry, i) => {
        const idx = (i * 3 + 1) % meshyCars.length;
        const next = meshyCars[idx]!.clone(true);
        setShadow(next);
        scene.add(next);
        scene.remove(entry.car);
        entry.car = next;
        entry.baseY = 0.02;
        entry.yaw = MESHY_YAW;
      });
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
          if (sedanCars.length < 5) spawnSedan();
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
