import * as THREE from "three";

import { decorDef, type DecorKind } from "./decor";
import { TILE, parseKey } from "./grid";
import type { CityPlan } from "./cityPlan";
import { rollerQualityLoss, STREET_VENDORS } from "./spareParts";

export type InteractionKind = "carWash" | "house" | "decor" | "streetLight" | "vendor";

export type NearbyInteraction = {
  id: string;
  kind: InteractionKind;
  icon: string;
  title: string;
  prompt: string;
  dialogue: string;
  distance: number;
  level?: number;
  decorKind?: DecorKind;
  vendorId?: string;
  price?: number;
};

export type InteractionContext = {
  washes: number;
  money: number;
  machinesRunning: boolean;
  rollerCondition: number;
};

const WASH_POSITION = new THREE.Vector2(2, -42);
const INTERACTION_RADIUS = 7;

function distanceTo(position: THREE.Vector3, x: number, z: number) {
  return Math.hypot(position.x - x, position.z - z);
}

export function findNearbyInteraction(
  position: THREE.Vector3,
  plan: CityPlan,
  context: InteractionContext,
): NearbyInteraction | null {
  const candidates: NearbyInteraction[] = [];
  STREET_VENDORS.forEach((vendor) => {
    const distance = distanceTo(position, vendor.x, vendor.z);
    if (distance > INTERACTION_RADIUS) return;
    const loss = rollerQualityLoss(context.rollerCondition);
    candidates.push({
      id: `vendor-${vendor.id}`,
      kind: "vendor",
      vendorId: vendor.id,
      price: vendor.price,
      icon: "🔧",
      title: vendor.name,
      prompt: "Parler au vendeur de pièces",
      dialogue: context.rollerCondition >= 100
        ? `Tes rouleaux sont neufs : état 100 %, aucune perte de qualité. Garde tes ${vendor.price} € pour plus tard.`
        : `Kit de roulements et lanières : ${vendor.price} €. Tes rouleaux sont à ${context.rollerCondition} % et réduisent actuellement la qualité de ${loss} %. La réparation les remet à 100 % et supprime cette perte.`,
      distance,
    });
  });
  const washDistance = distanceTo(position, WASH_POSITION.x, WASH_POSITION.y);
  if (washDistance <= 11) {
    candidates.push({
      id: "car-wash",
      kind: "carWash",
      icon: "🫧",
      title: "Car wash Tikowiko",
      prompt: "Interagir avec la station",
      dialogue: context.machinesRunning
        ? `La station tourne parfaitement. ${context.washes} voiture${context.washes === 1 ? " a" : "s ont"} déjà été lavée${context.washes === 1 ? "" : "s"}. Le solde est de ${context.money.toLocaleString("fr-FR")} €.`
        : "Certaines machines sont arrêtées. Je peux remettre toute la station en marche.",
      distance: washDistance,
    });
  }

  plan.houses.forEach((house, key) => {
    const [cx, cz] = parseKey(key);
    const distance = distanceTo(position, cx * TILE, cz * TILE);
    if (distance > INTERACTION_RADIUS) return;
    candidates.push({
      id: `house-${key}`,
      kind: "house",
      icon: "🏠",
      title: `Maison niveau ${house.level}`,
      prompt: "Frapper à la porte",
      dialogue:
        house.level >= 3
          ? "Une grande famille habite ici. Elle apprécie les nouveaux services du quartier."
          : "Les habitants me saluent et me parlent de la croissance de TikowikoCity.",
      distance,
      level: house.level,
    });
  });

  plan.decor.forEach((decor, key) => {
    const [cx, cz] = parseKey(key);
    const distance = distanceTo(position, cx * TILE, cz * TILE);
    if (distance > INTERACTION_RADIUS) return;
    const def = decorDef(decor.kind);
    const reactions: Record<DecorKind, string> = {
      park: "Quel coin paisible ! Les arbres rendent vraiment le quartier plus vivant.",
      garden: "Ces fleurs donnent de belles couleurs à la ville.",
      fountain: "L'eau de la fontaine est fraîche et son bruit couvre doucement la circulation.",
      playground: "Les enfants du quartier vont adorer cette aire de jeux.",
      parking: "Ce parking facilite l'accès aux bâtiments voisins.",
      carport: "Les voitures sont bien protégées ici.",
      truckstop: "Cette aire permet aux véhicules lourds de faire une vraie pause.",
    };
    candidates.push({
      id: `decor-${key}`,
      kind: "decor",
      icon: def.icon,
      title: def.label,
      prompt: `Observer ${def.label.toLocaleLowerCase("fr-FR")}`,
      dialogue: reactions[decor.kind],
      distance,
      decorKind: decor.kind,
    });
  });

  plan.cells.forEach((cell, key) => {
    if (!cell.light && !cell.lamp) return;
    const [cx, cz] = parseKey(key);
    const distance = distanceTo(position, cx * TILE, cz * TILE);
    if (distance > 4.5) return;
    candidates.push({
      id: `light-${key}`,
      kind: "streetLight",
      icon: cell.light ? "🚦" : "💡",
      title: cell.light ? "Feu de circulation" : "Lampadaire",
      prompt: "Examiner le mobilier",
      dialogue: cell.light
        ? "Le feu organise le passage des voitures et protège les piétons."
        : "Ce lampadaire sécurise la rue dès que la nuit tombe.",
      distance,
    });
  });

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0] ?? null;
}