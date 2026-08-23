import * as THREE from "three";
import { TILE } from "@/game/grid";

/**
 * Correctifs visuels légers appliqués au runtime sans modifier la logique du jeu.
 * - conserve les modèles Kenney mais restaure des carrosseries opaques/colorées ;
 * - rend les vitres propres et les feux arrière petits/nettement définis ;
 * - redresse et réduit les feux tricolores ;
 * - complète les intersections avec quatre feux ;
 * - empêche les PointLight des maisons d'illuminer toute la façade.
 */
const marker = "__tikowikoNightVisualFixInstalled";
const globalState = globalThis as typeof globalThis & Record<string, unknown>;

if (!globalState[marker]) {
  globalState[marker] = true;

  const CAR_NAMES = [
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
  const carNames = new Set<string>(CAR_NAMES);
  const carPalette = new Map<string, number>([
    ["sedan", 0xb8bec7],
    ["sedan-sports", 0xd94848],
    ["suv", 0x2f80ed],
    ["suv-luxury", 0x7f8c9a],
    ["taxi", 0xf2c94c],
    ["van", 0x27ae60],
    ["delivery", 0xf2994a],
    ["hatchback-sports", 0x9b51e0],
    ["police", 0xe7edf2],
    ["truck", 0x00a6a6],
    ["ambulance", 0xf4f4f1],
  ]);

  const rearLampGeo = new THREE.BoxGeometry(0.13, 0.1, 0.045);
  const rearLampMat = new THREE.MeshStandardMaterial({
    color: 0xb91f2d,
    emissive: 0xff2638,
    emissiveIntensity: 0.42,
    roughness: 0.35,
    metalness: 0,
  });

  const capNumberProperty = (obj: object, key: string, max: number) => {
    const record = obj as Record<string, unknown>;
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor?.get || descriptor?.set) return;
    let value = Math.min(Number(record[key] ?? 0), max);
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (next: unknown) => {
        const n = Number(next);
        value = Number.isFinite(n) ? Math.min(n, max) : 0;
      },
    });
  };

  const styleCar = (car: THREE.Object3D, sourceName: string) => {
    const fallback = new THREE.Color(carPalette.get(sourceName) ?? 0xb8bec7);
    let hasRearLight = false;

    car.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const styled = source.map((raw) => {
        const material = raw.clone() as THREE.MeshStandardMaterial;
        const tag = `${mesh.name} ${material.name}`.toLowerCase();
        const wheel = /wheel|tire|tyre/.test(tag);
        const glass = /glass|window|windshield/.test(tag);
        const rear = /tail.?light|rear.?light|brake.?light/.test(tag);

        if (rear && material.color) {
          hasRearLight = true;
          material.color.setHex(0xb91f2d);
          material.emissive.setHex(0xff2638);
          material.emissiveIntensity = 0.42;
          material.transparent = false;
          material.opacity = 1;
          return material;
        }

        if (wheel && material.color) {
          material.color.setHex(0x20242a);
          material.roughness = 0.95;
          material.metalness = 0.04;
          return material;
        }

        if (glass && material.color) {
          material.color.setHex(0x9fc9dc);
          material.transparent = true;
          material.opacity = 0.72;
          material.depthWrite = false;
          material.roughness = 0.12;
          material.metalness = 0.02;
          return material;
        }

        if (material.color) {
          const hsl = { h: 0, s: 0, l: 0 };
          material.color.getHSL(hsl);
          if (!material.map && hsl.s < 0.15 && hsl.l > 0.38) {
            material.color.copy(fallback);
            material.transparent = false;
            material.opacity = 1;
            material.roughness = Math.min(material.roughness, 0.72);
          }
        }
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? styled : styled[0]!;
    });

    if (!hasRearLight) {
      car.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(car);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      if (
        Number.isFinite(size.x) &&
        Number.isFinite(size.y) &&
        Number.isFinite(size.z) &&
        size.x > 0.2 &&
        size.z > 0.2
      ) {
        const rearZ = box.min.z - 0.02;
        const y = box.min.y + size.y * 0.34;
        for (const side of [-1, 1]) {
          const lamp = new THREE.Mesh(rearLampGeo, rearLampMat);
          lamp.name = "tikowiko-rear-light";
          lamp.position.set(center.x + side * size.x * 0.34, y, rearZ);
          car.add(lamp);
        }
      }
    }
  };

  type Object3DPatch = {
    clone: (this: THREE.Object3D, recursive?: boolean) => THREE.Object3D;
    add: (this: THREE.Object3D, ...objects: THREE.Object3D[]) => THREE.Object3D;
  };
  const objectProto = THREE.Object3D.prototype as unknown as Object3DPatch;
  const originalClone = objectProto.clone;

  objectProto.clone = function patchedClone(this: THREE.Object3D, recursive = true) {
    const cloned = originalClone.call(this, recursive);
    if (carNames.has(this.name)) styleCar(cloned, this.name);
    return cloned;
  };

  const isTrafficGroup = (obj: THREE.Object3D) => {
    let found = false;
    obj.traverse((node) => {
      if (node.name === "traffic-light") found = true;
    });
    return found;
  };

  const prepareTrafficGroup = (obj: THREE.Object3D) => {
    obj.rotation.x = 0;
    obj.rotation.z = 0;
    obj.traverse((node) => {
      if (node.name === "traffic-light") {
        node.rotation.x = 0;
        node.rotation.z = 0;
        node.scale.setScalar(5);
      }
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((raw) => {
        const material = raw as THREE.MeshStandardMaterial;
        if (!material.emissive) return;
        const emissive = material.emissive.getHex();
        if (emissive === 0xff3b30 || emissive === 0x33d17a) {
          mesh.scale.multiplyScalar(0.68);
          capNumberProperty(material, "emissiveIntensity", 0.95);
        }
      });
    });
  };

  const tameHouseLighting = (obj: THREE.Object3D) => {
    if (obj instanceof THREE.PointLight && obj.color.getHex() === 0xffc56e) {
      obj.visible = false;
      obj.castShadow = false;
    }
    obj.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((raw) => {
        const material = raw as THREE.MeshStandardMaterial;
        if (material.userData?.["nightWindow"]) {
          capNumberProperty(material, "emissiveIntensity", 0.62);
        }
      });
    });
  };

  const originalAdd = objectProto.add;
  objectProto.add = function patchedAdd(this: THREE.Object3D, ...objects: THREE.Object3D[]) {
    objects.forEach((obj) => tameHouseLighting(obj));

    const trafficObjects = objects.filter(
      (obj) => !obj.userData["tikowikoTrafficDuplicate"] && isTrafficGroup(obj),
    );
    trafficObjects.forEach(prepareTrafficGroup);

    const result = originalAdd.apply(this, objects);

    trafficObjects.forEach((obj) => {
      const cx = Math.round(obj.position.x / TILE) * TILE;
      const cz = Math.round(obj.position.z / TILE) * TILE;
      const dx = obj.position.x - cx;
      const dz = obj.position.z - cz;
      if (Math.abs(dx) < TILE * 0.2 || Math.abs(dz) < TILE * 0.2) return;

      const duplicate = originalClone.call(obj, true);
      duplicate.userData["tikowikoTrafficDuplicate"] = true;
      duplicate.position.set(cx - dx, obj.position.y, cz + dz);
      duplicate.rotation.set(0, -obj.rotation.y, 0);
      prepareTrafficGroup(duplicate);
      originalAdd.call(this, duplicate);
    });

    return result;
  };
}
