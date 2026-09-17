export type UrbanEventKind = "festival" | "strike" | "building";

export type UrbanEvent = {
  id: string;
  kind: UrbanEventKind;
  title: string;
  description: string;
  startedAt: number;
  endsAt: number;
};

export const URBAN_EVENT_META: Record<UrbanEventKind, { icon: string; trafficFactor: number; satisfactionBonus: number }> = {
  festival: { icon: "🎉", trafficFactor: 1.45, satisfactionBonus: 6 },
  strike: { icon: "✊", trafficFactor: 0.58, satisfactionBonus: -4 },
  building: { icon: "🏗️", trafficFactor: 1, satisfactionBonus: 0 },
};

export const EVENT_MIN_DURATION_MS = 5 * 60_000;
export const EVENT_MAX_DURATION_MS = 8 * 60_000;
export const EVENT_COOLDOWN_MIN_MS = 3 * 60_000;
export const EVENT_COOLDOWN_MAX_MS = 5 * 60_000;

export function makeUrbanEvent(kind: UrbanEventKind, now = Date.now()): UrbanEvent {
  const duration = kind === "building" ? 12_000 : EVENT_MIN_DURATION_MS + Math.random() * (EVENT_MAX_DURATION_MS - EVENT_MIN_DURATION_MS);
  const copy = kind === "festival"
    ? ["Fête de quartier", "Les visiteurs affluent et repartent avec une voiture brillante."]
    : kind === "strike"
      ? ["Grève des transports", "La circulation ralentit et moins de clients rejoignent la station."]
      : ["Nouveau bâtiment", "La ville offre une construction gratuite au quartier."];
  return { id: `${now}-${kind}`, kind, title: copy[0], description: copy[1], startedAt: now, endsAt: now + duration };
}

export function randomUrbanEvent(now = Date.now()) {
  const roll = Math.random();
  return makeUrbanEvent(roll < 0.42 ? "festival" : roll < 0.78 ? "strike" : "building", now);
}

export function sanitizeUrbanEvent(raw: unknown): UrbanEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<UrbanEvent>;
  if (!value.kind || !(value.kind in URBAN_EVENT_META)) return null;
  if (typeof value.startedAt !== "number" || typeof value.endsAt !== "number") return null;
  return {
    id: typeof value.id === "string" ? value.id : `${value.startedAt}-${value.kind}`,
    kind: value.kind,
    title: typeof value.title === "string" ? value.title : makeUrbanEvent(value.kind, value.startedAt).title,
    description: typeof value.description === "string" ? value.description : makeUrbanEvent(value.kind, value.startedAt).description,
    startedAt: value.startedAt,
    endsAt: value.endsAt,
  };
}

export const eventTrafficFactor = (event: UrbanEvent | null) => event ? URBAN_EVENT_META[event.kind].trafficFactor : 1;
export const eventSatisfactionBonus = (event: UrbanEvent | null) => event ? URBAN_EVENT_META[event.kind].satisfactionBonus : 0;
export const nextEventDelay = () => EVENT_COOLDOWN_MIN_MS + Math.random() * (EVENT_COOLDOWN_MAX_MS - EVENT_COOLDOWN_MIN_MS);
