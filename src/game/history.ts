/* Journal de la partie : lavages, améliorations, constructions…
   Chaque entrée garde la date, un libellé, le montant (signé) et le solde. */

export type EventKind = "wash" | "upgrade" | "parts" | "build" | "house" | "decor" | "urban" | "info";

export type GameEvent = {
  id: string;
  /** Date ISO de l'événement. */
  at: string;
  kind: EventKind;
  /** Libellé lisible ("Lavage #12", "Maison niveau 2"…). */
  label: string;
  /** Montant en € : positif = gain, négatif = dépense, absent = neutre. */
  amount?: number;
  /** Solde du joueur juste après l'événement (€). */
  balance?: number;
  flow?: "income" | "expense" | "neutral";
};

/** Ancien format (lavages uniquement) conservé pour la compatibilité. */
export type WashEntry = GameEvent;

/** Nombre maximum d'entrées conservées (les plus récentes d'abord). */
export const MAX_HISTORY = 80;

export const EVENT_META: Record<EventKind, { icon: string; label: string }> = {
  wash: { icon: "🫧", label: "Lavages" },
  upgrade: { icon: "🛠️", label: "Améliorations" },
  parts: { icon: "🔧", label: "Pièces et entretien" },
  build: { icon: "🚧", label: "Voirie" },
  house: { icon: "🏠", label: "Maisons" },
  decor: { icon: "🌳", label: "Aménagements" },
  urban: { icon: "🎉", label: "Événements urbains" },
  info: { icon: "📌", label: "Divers" },
};

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatWashDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : timeFmt.format(d);
}

export function makeEvent(
  kind: EventKind,
  label: string,
  amount?: number,
  balance?: number,
): GameEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    kind,
    label,
    ...(amount === undefined ? {} : { amount }),
    ...(balance === undefined ? {} : { balance }),
    flow: amount === undefined || amount === 0 ? "neutral" : amount > 0 ? "income" : "expense",
  };
}

const KINDS = Object.keys(EVENT_META) as EventKind[];

export function sanitizeHistory(raw: unknown): GameEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: GameEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const amount = typeof e['amount'] === "number" && Number.isFinite(e['amount'])
      ? (e['amount'] as number)
      : undefined;
    const balance = typeof e['balance'] === "number" && Number.isFinite(e['balance'])
      ? (e['balance'] as number)
      : undefined;
    const kind = KINDS.includes(e['kind'] as EventKind) ? (e['kind'] as EventKind) : "wash";
    const wash = typeof e['wash'] === "number" ? (e['wash'] as number) : undefined;
    const label =
      typeof e['label'] === "string" && e['label']
        ? (e['label'] as string)
        : wash !== undefined
          ? `Lavage #${wash}`
          : "Lavage";
    out.push({
      id: typeof e['id'] === "string" ? e['id'] : `${out.length}-${label}`,
      at: typeof e['at'] === "string" ? e['at'] : new Date().toISOString(),
      kind,
      label,
      ...(amount === undefined ? {} : { amount }),
      ...(balance === undefined ? {} : { balance }),
      flow: e['flow'] === "income" || e['flow'] === "expense" || e['flow'] === "neutral"
        ? e['flow']
        : amount === undefined || amount === 0 ? "neutral" : amount > 0 ? "income" : "expense",
    });
    if (out.length >= MAX_HISTORY) break;
  }
  return out;
}
