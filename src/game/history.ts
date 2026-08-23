/* Historique des lavages du car wash : chaque entrée garde la date,
   le montant gagné et le solde juste après la transaction. */

export type WashEntry = {
  id: string;
  /** Date ISO du lavage terminé. */
  at: string;
  /** Montant gagné pour ce lavage (€). */
  amount: number;
  /** Solde du joueur après la transaction (€). */
  balance: number;
  /** Numéro du lavage (1 = premier lavage). */
  wash: number;
};

/** Nombre maximum d'entrées conservées (les plus récentes d'abord). */
export const MAX_HISTORY = 50;

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

export function sanitizeHistory(raw: unknown): WashEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: WashEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const amount = e.amount;
    const balance = e.balance;
    if (typeof amount !== "number" || !Number.isFinite(amount)) continue;
    if (typeof balance !== "number" || !Number.isFinite(balance)) continue;
    out.push({
      id: typeof e.id === "string" ? e.id : `${out.length}-${amount}`,
      at: typeof e.at === "string" ? e.at : new Date().toISOString(),
      amount,
      balance,
      wash: typeof e.wash === "number" && Number.isFinite(e.wash) ? e.wash : out.length + 1,
    });
    if (out.length >= MAX_HISTORY) break;
  }
  return out;
}
