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

/* Les voitures Meshy sont normalisées face à +X : décalage pour aligner
   l'avant sur le sens de circulation (convention modèle Kenney = +Z). */
const MESHY_YAW = -Math.PI / 2;



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
    camera.position.set(-18, 14, 24);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(2, 1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 60;
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
    sun.shadow.camera.far = 80;
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
    const sedanCars: THREE.Object3D[] = [];
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
      dir: number;
      u: number;
      speed: number;
      lane: number;
      yaw: number;
      baseY: number;
    };
    const trafficCars: TrafficCar[] = [];
    let cityCurve: THREE.CatmullRomCurve3 | null = null;
    let cityLen = 1;


    const spawnSedan = () => {
      const template =
        meshyCars.length > 0
          ? meshyCars[Math.floor(Math.random() * meshyCars.length)]!
          : models["sedan"];
      if (!template) return;
      const sedan = template.clone(true);
      setShadow(sedan);
      const isKenney = template === models["sedan"];
      if (isKenney) sedan.rotation.y = Math.PI / 2;
      const baseY = isKenney ? CAR_Y : 0.06;
      sedan.userData["baseY"] = baseY;
      sedan.position.set(PATH_START, baseY, 0);
      sedan.userData["wheels"] = findWheels(sedan);
      tintCar(sedan, 1);
      scene.add(sedan);

      sedanCars.push(sedan);
    };
    spawnRef.current = spawnSedan;




    let cinemaMode = false;
    cinemaRef.current = () => {
      cinemaMode = !cinemaMode;
      controls.enabled = !cinemaMode;
      setCinema(cinemaMode);
    };

    const buildHouse = (x: number, z: number) => {
      place(models["hFloor"]!, x, 0, z);
      place(models["hWallWindow"]!, x - 1, 0, z, 0);
      place(models["hWallWindow"]!, x + 1, 0, z, Math.PI);
      place(models["hWallWindow"]!, x, 0, z + 1, Math.PI / 2);
      place(models["hWallWindow"]!, x, 0, z - 1, -Math.PI / 2);
      place(models["hRoof"]!, x, 2.4, z);
    };

    const buildScene = () => {

      for (let x = -13; x <= 13; x += 1) {
        [-1, 0, 1].forEach((z) => place(models["roadStraight"]!, x, ROAD_Y, z, 0));
      }

      const tunnel = models["tunnel"]!.clone(true);
      tunnel.rotation.y = Math.PI / 2;
      tunnel.position.set(2, 0, 0);
      setShadow(tunnel);
      scene.add(tunnel);


      // Tapis roulant
      const conveyor = makeConveyor();
      scene.add(conveyor.group);
      conveyorSlats.push(...conveyor.slats);

      // Brosses verticales de chaque côté
      [-1, 1].forEach((zSide, si) => {
        [0, 2.5].forEach((offset, oi) => {
          const pivot = new THREE.Group();
          const spin = makeBrush();
          pivot.add(spin);
          pivot.position.set(WASH_ZONE[0] + 1.2 + offset, ROAD_Y + 1.05, zSide * 1.5);
          scene.add(pivot);
          brushes.push({
            pivot,
            spin,
            dir: (si + oi) % 2 === 0 ? 1 : -1,
            kind: "roller",
          });
        });
      });

      // Brosse horizontale au-dessus du tapis
      [1.2, 3.8].forEach((x, i) => {
        const pivot = new THREE.Group();
        pivot.rotation.x = Math.PI / 2;
        const spin = makeBrush();
        pivot.add(spin);
        pivot.position.set(x, ROAD_Y + 2.1, 0);
        scene.add(pivot);
        brushes.push({ pivot, spin, dir: i % 2 === 0 ? -1 : 1, kind: "brush" });
      });

      for (let i = 0; i < 2; i++) {
        const foam = makeFoamVeil();
        foam.position.set(1.5 + i * 2, ROAD_Y + 1.2, 0);
        scene.add(foam);
        foamSprites.push(foam);
      }

      spawnSedan();

      // ----- Ville : boulevard en boucle avec virages, immeubles alignés -----
      const halfX = 17;
      const halfZ = 11.5;
      const r = 5;
      const pts: THREE.Vector3[] = [];
      const corners: Array<[number, number, number]> = [
        [halfX - r, halfZ - r, 0],
        [-(halfX - r), halfZ - r, Math.PI / 2],
        [-(halfX - r), -(halfZ - r), Math.PI],
        [halfX - r, -(halfZ - r), -Math.PI / 2],
      ];
      // segments droits + quarts de virage (sens horaire vu de dessus)
      corners.forEach(([cx, cz, a0]) => {
        for (let s = 0; s <= 6; s++) {
          const a = a0 + (s / 6) * (Math.PI / 2);
          pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r));
        }
      });
      const cityCurveLocal = new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.5);
      cityCurve = cityCurveLocal;
      cityLen = cityCurveLocal.getLength();

      const normalAt = (u: number) => {
        const tan = cityCurveLocal.getTangentAt(u);
        return new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      };

      // Chaussée
      const ROAD_W = 7;
      const N = 420;
      const posArr: number[] = [];
      const idxArr: number[] = [];
      for (let i = 0; i <= N; i++) {
        const u = (i % N) / N;
        const p = cityCurveLocal.getPointAt(u);
        const n = normalAt(u);
        const a = p.clone().addScaledVector(n, ROAD_W / 2);
        const b = p.clone().addScaledVector(n, -ROAD_W / 2);
        posArr.push(a.x, 0.02, a.z, b.x, 0.02, b.z);
      }
      for (let i = 0; i < N; i++) {
        const o = i * 2;
        idxArr.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
      roadGeo.setIndex(idxArr);
      roadGeo.computeVertexNormals();
      const roadMesh = new THREE.Mesh(
        roadGeo,
        new THREE.MeshStandardMaterial({
          color: 0x4a4f57,
          roughness: 0.95,
          side: THREE.DoubleSide,
        }),

      );
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      // Ligne centrale discontinue
      const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5f0d8, roughness: 0.7 });
      const dashGeo = new THREE.BoxGeometry(1.1, 0.02, 0.16);
      const dashes = Math.round(cityLen / 3);
      for (let i = 0; i < dashes; i++) {
        const u = i / dashes;
        const p = cityCurveLocal.getPointAt(u);
        const tan = cityCurveLocal.getTangentAt(u);
        const d = new THREE.Mesh(dashGeo, dashMat);
        d.position.set(p.x, 0.04, p.z);
        d.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2;
        scene.add(d);
      }

      const buildingMats = [0xdfe6ee, 0xf3d6a8, 0xcfe3d0, 0xefc4c4, 0xd8d2ef].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }),
      );
      const windowMat = new THREE.MeshStandardMaterial({
        color: 0x8fd3ff,
        roughness: 0.25,
        metalness: 0.1,
      });
      const makeBuilding = (
        x: number,
        z: number,
        w: number,
        h: number,
        d: number,
        mi: number,
        rotY: number,
      ) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMats[mi]!);
        body.position.y = h / 2;
        g.add(body);
        for (let fy = 0.8; fy < h - 0.5; fy += 1.1) {
          for (let fx = -w / 2 + 0.5; fx < w / 2 - 0.2; fx += 0.9) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.06), windowMat);
            win.position.set(fx, fy, d / 2 + 0.03);
            g.add(win);
            const back = win.clone();
            back.position.z = -d / 2 - 0.03;
            g.add(back);
          }
        }
        g.position.set(x, 0, z);
        g.rotation.y = rotY;
        setShadow(g);
        scene.add(g);
      };

      // Immeubles alignés le long du boulevard (extérieur de la boucle)
      const BLOCKS = 26;
      for (let i = 0; i < BLOCKS; i++) {
        const u = (i + 0.5) / BLOCKS;
        const p = cityCurveLocal.getPointAt(u);
        const tan = cityCurveLocal.getTangentAt(u);
        const n = normalAt(u);
        const w = 3 + (i % 3) * 0.7;
        const d = 2.8 + (i % 2) * 0.8;
        const h = 3 + ((i * 7) % 6) * 1.4;
        const out = p.clone().addScaledVector(n, ROAD_W / 2 + d / 2 + 1.4);
        makeBuilding(out.x, out.z, w, h, d, i % 5, Math.atan2(tan.x, tan.z) + Math.PI / 2);
      }

      // Arbres sur le trottoir intérieur du boulevard
      for (let i = 0; i < 22; i++) {
        const u = (i + 0.25) / 22;
        const p = cityCurveLocal.getPointAt(u);
        const n = normalAt(u);
        const q = p.clone().addScaledVector(n, -(ROAD_W / 2 + 1.1));
        const tr = makeTree();
        tr.position.set(q.x, 0, q.z);
        scene.add(tr);
      }

      // Voitures qui circulent sur le boulevard (deux sens séparés)
      const cityTemplates = [models["taxi"]!, models["sedan"]!];
      for (let i = 0; i < 10; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const car = cityTemplates[i % cityTemplates.length]!.clone(true);
        setShadow(car);
        scene.add(car);
        trafficCars.push({
          car,
          dir,
          u: (i / 10) % 1,
          speed: 3 + Math.random() * 2,
          lane: dir > 0 ? -1.7 : 1.7,
          yaw: 0,
          baseY: CAR_Y,
        });
      }

      const houseSpots: Array<[number, number]> = [
        [-11, 4.5],
        [-8, 5],
        [8, 5],
        [11, 4.5],
        [-11, -4.5],
        [-8, -5],
        [8, -5],
        [11, -4.5],
      ];
      houseSpots.forEach(([x, z]) => buildHouse(x, z));

      for (let i = 0; i < 10; i++) {
        const t = makeTree();
        const side = i % 2 === 0 ? -1 : 1;
        t.position.set(-13 + i * 2.9, 0, side * 2.6 + (Math.random() * 0.6 - 0.3));
        scene.add(t);
      }
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
          scene.remove(car);
          sedanCars.splice(i, 1);
        }
      }

      const carInWash = sedanCars.some(
        (c) => c.position.x > zoneStart && c.position.x < zoneEnd,
      );

      // Rouleaux : ils tournent en continu, plus vite quand une voiture passe
      const brushSpeed = carInWash ? 9 : 2;
      brushes.forEach((b) => {
        const on = b.kind === "roller" ? ctl.rollers : ctl.brushes;
        if (!on) return;
        b.spin.rotation.y += dt * brushSpeed * b.dir;
      });

      // Tapis roulant : les lattes défilent en boucle
      const beltLen = zoneEnd - zoneStart;
      if (ctl.belt) {
        conveyorSlats.forEach((s) => {
          s.position.x += dt * BELT_SPEED;
          if (s.position.x > zoneEnd) s.position.x -= beltLen;
        });
      }

      // Circulation en ville : suivi du boulevard, virages inclus
      if (cityCurve) {
        const curve = cityCurve;
        trafficCars.forEach((e) => {
          if (ctl.traffic) {
            e.u = (e.u + (dt * e.speed * e.dir) / cityLen + 1) % 1;
          }
          const p = curve.getPointAt(e.u);
          const tan = curve.getTangentAt(e.u);
          const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
          e.car.position.set(p.x + n.x * e.lane, e.baseY, p.z + n.z * e.lane);
          e.car.rotation.y = Math.atan2(tan.x * e.dir, tan.z * e.dir) + e.yaw;
        });
      }



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
          Math.sin(angle) * 20 + 2,
        );
        camera.lookAt(2, 2, 0);
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
