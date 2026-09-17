export type WashMetrics = {
  count: number;
  revenue: number;
  totalDuration: number;
  totalSatisfaction: number;
  premiumCount: number;
};

export type FinancePeriod = {
  index: number;
  income: number;
  expenses: number;
};

export const EMPTY_WASH_METRICS: WashMetrics = { count: 0, revenue: 0, totalDuration: 0, totalSatisfaction: 0, premiumCount: 0 };
export const PERIOD_SECONDS = 30 * 60;

const finite = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export function sanitizeWashMetrics(raw: unknown): WashMetrics {
  const v = raw && typeof raw === "object" ? raw as Partial<WashMetrics> : {};
  return {
    count: Math.max(0, Math.round(finite(v.count))),
    revenue: Math.max(0, finite(v.revenue)),
    totalDuration: Math.max(0, finite(v.totalDuration)),
    totalSatisfaction: Math.max(0, finite(v.totalSatisfaction)),
    premiumCount: Math.max(0, Math.round(finite(v.premiumCount))),
  };
}

export function sanitizeFinancePeriods(raw: unknown): FinancePeriod[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Partial<FinancePeriod>;
    if (typeof value.index !== "number" || !Number.isFinite(value.index)) return [];
    return [{ index: Math.max(0, Math.floor(value.index)), income: Math.max(0, finite(value.income)), expenses: Math.max(0, finite(value.expenses)) }];
  }).slice(-48);
}

export function recordFinance(periods: FinancePeriod[], elapsedSeconds: number, amount?: number): FinancePeriod[] {
  if (!amount) return periods;
  const index = Math.floor(Math.max(0, elapsedSeconds) / PERIOD_SECONDS);
  const next = periods.map((period) => ({ ...period }));
  let period = next.find((item) => item.index === index);
  if (!period) {
    period = { index, income: 0, expenses: 0 };
    next.push(period);
  }
  if (amount > 0) period.income += amount;
  else period.expenses += Math.abs(amount);
  return next.sort((a, b) => a.index - b.index).slice(-48);
}

export function washAverages(metrics: WashMetrics) {
  const divisor = Math.max(1, metrics.count);
  return {
    revenue: metrics.revenue / divisor,
    duration: metrics.totalDuration / divisor,
    satisfaction: metrics.totalSatisfaction / divisor,
    premiumRate: metrics.premiumCount / divisor * 100,
  };
}

export function formatPlayTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}
