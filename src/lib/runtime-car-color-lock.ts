import * as THREE from "three";

/** Empêche la teinte de saleté du car wash d'écraser les vraies couleurs Kenney. */
const globalState = globalThis as typeof globalThis & Record<string, unknown>;
const INSTALL_KEY = "__tikowikoCarColorLockInstalled";
const DIRT_HEX = 0x8a7355;
const CAR_NAMES = new Set([
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
]);

type TaggedColor = THREE.Color & { __tikowikoCarColor?: boolean };
type TaggedMaterial = THREE.MeshStandardMaterial & {
  userData: Record<string, unknown>;
};

if (!globalState[INSTALL_KEY]) {
  globalState[INSTALL_KEY] = true;

  const tagMaterial = (material: THREE.Material) => {
    const mat = material as TaggedMaterial;
    if (!mat.color) return;
    mat.userData["tikowikoCarMaterial"] = true;
    (mat.color as TaggedColor).__tikowikoCarColor = true;
  };

  const tagCar = (car: THREE.Object3D) => {
    car.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(tagMaterial);
    });
  };

  /* Les matériaux sont clonés une seconde fois par tintCar(). On propage donc
     le marqueur vers ces clones afin que la protection reste active. */
  const originalMaterialClone = THREE.MeshStandardMaterial.prototype.clone;
  THREE.MeshStandardMaterial.prototype.clone = function patchedMaterialClone() {
    const cloned = originalMaterialClone.call(this);
    if ((this.userData as Record<string, unknown>)["tikowikoCarMaterial"]) {
      tagMaterial(cloned);
    }
    return cloned;
  };

  /* runtime-visual-fix.ts a déjà pu personnaliser le modèle : ce wrapper passe
     après lui, récupère son clone final puis marque uniquement les voitures. */
  const originalObjectClone = THREE.Object3D.prototype.clone;
  THREE.Object3D.prototype.clone = function patchedObjectClone(recursive = true) {
    const cloned = originalObjectClone.call(this, recursive);
    if (CAR_NAMES.has(this.name)) tagCar(cloned);
    return cloned;
  };

  /* tintCar() fait color.copy(base).lerp(DIRT_COLOR, ...). Pour une couleur de
     voiture uniquement, on ignore CE lerp précis vers la couleur de saleté.
     Tous les autres lerp Three.js restent inchangés. */
  const originalColorLerp = THREE.Color.prototype.lerp;
  THREE.Color.prototype.lerp = function patchedColorLerp(color: THREE.Color, alpha: number) {
    const tagged = this as TaggedColor;
    if (tagged.__tikowikoCarColor && color.getHex() === DIRT_HEX) return this;
    return originalColorLerp.call(this, color, alpha);
  };
}
