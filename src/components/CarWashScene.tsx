import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import modelsAsset from "@/assets/car-wash-models.json.asset.json";

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

    const models: Record<string, THREE.Group> = {};
    const sedanCars: THREE.Object3D[] = [];
    const brushes: THREE.Object3D[] = [];
    const foamSprites: THREE.Object3D[] = [];

    const spawnSedan = () => {
      const template = models["sedan"];
      if (!template) return;
      const sedan = template.clone(true);
      setShadow(sedan);
      sedan.rotation.y = Math.PI / 2;
      sedan.position.set(PATH_START, CAR_Y, 0);
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

      [-1, 1].forEach((zSide) => {
        [1, 3].forEach((x) => {
          const brush = makeBrush();
          brush.position.set(x, ROAD_Y + 0.9, zSide * 1.5);
          brush.rotation.z = Math.PI / 2;
          scene.add(brush);
          brushes.push(brush);
        });
      });

      for (let i = 0; i < 2; i++) {
        const foam = makeFoamVeil();
        foam.position.set(1.5 + i * 2, ROAD_Y + 1.2, 0);
        scene.add(foam);
        foamSprites.push(foam);
      }

      const taxi = models["taxi"]!.clone(true);
      taxi.rotation.y = Math.PI / 2;
      taxi.position.set(-9, CAR_Y, -2.6);
      setShadow(taxi);
      tintCar(taxi, 1);
      scene.add(taxi);

      spawnSedan();

      const houseSpots: Array<[number, number]> = [
        [-11, 4],
        [-8, 4.5],
        [8, 4.5],
        [11, 4],
        [-11, -4],
        [-8, -4.5],
        [8, -4.5],
        [11, -4],
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

      const SPEED = 2.2;
      for (let i = sedanCars.length - 1; i >= 0; i--) {
        const car = sedanCars[i]!;
        car.position.x += dt * SPEED;

        (car.userData["wheels"] as THREE.Object3D[]).forEach((w) => {
          w.rotation.x -= dt * SPEED * 3.2;
        });

        const [zoneStart, zoneEnd] = WASH_ZONE;
        let dirtiness: number;
        if (car.position.x <= zoneStart) dirtiness = 1;
        else if (car.position.x >= zoneEnd) dirtiness = 0;
        else dirtiness = 1 - (car.position.x - zoneStart) / (zoneEnd - zoneStart);
        tintCar(car, dirtiness);

        car.position.y =
          car.position.x > zoneStart && car.position.x < zoneEnd
            ? CAR_Y + Math.sin(t * 30) * 0.01
            : CAR_Y;

        if (car.position.x > PATH_END) {
          scene.remove(car);
          sedanCars.splice(i, 1);
        }
      }

      const carInWash = sedanCars.some(
        (c) => c.position.x > WASH_ZONE[0] && c.position.x < WASH_ZONE[1],
      );
      brushes.forEach((b, i) => {
        b.rotation.x += dt * (carInWash ? 10 : 1.5) * (i % 2 === 0 ? 1 : -1);
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

    loadAll()
      .then(() => {
        if (disposed) return;
        buildScene();
        setLoading(false);
        animate();
      })
      .catch((err: unknown) => {
        console.error(err);
        setMessage("Oups, un modèle n'a pas pu charger.");
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
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
        <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-wide">
          <span aria-hidden>🫧</span> Le Car Wash de Kenney
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed opacity-85">
          Construit avec les kits Kenney (voitures, routes, bâtiments). Glisse pour tourner la
          caméra, molette pour zoomer.
        </p>
      </div>

      <div className="pointer-events-none fixed bottom-4 left-4 text-[11.5px] text-ink opacity-75 drop-shadow-[0_1px_0_rgba(255,255,255,.6)]">
        <p>🖱️ Glisser = tourner • Molette = zoomer • Clic droit = déplacer</p>
        <p className="mt-1 opacity-80">Modèles Kenney (kenney.nl) — licence CC0</p>
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
