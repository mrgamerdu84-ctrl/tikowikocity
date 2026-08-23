import { useEffect, useMemo, useRef, useState } from "react";
import type { SerializedHouses } from "@/game/cityPlan";
import {
  RENT_CYCLE_MS,
  makeNeed,
  makeRentalOffer,
  rentForLevel,
  taxForLevel,
  type Rental,
  type RentalOffer,
} from "@/game/rentals";

const STORAGE_KEY = "tikowiko.rentals.v1";

type Persisted = {
  rentals: Rental[];
  offers: RentalOffer[];
  rejected: string[];
};

type Props = {
  houses: SerializedHouses;
  balance: number;
  onIncome: (gross: number, tax: number, label: string) => void;
  onSpend: (amount: number, label: string) => boolean;
};

function readPersisted(): Persisted {
  if (typeof window === "undefined") return { rentals: [], offers: [], rejected: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rentals: [], offers: [], rejected: [] };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      rentals: Array.isArray(parsed.rentals) ? parsed.rentals : [],
      offers: Array.isArray(parsed.offers) ? parsed.offers : [],
      rejected: Array.isArray(parsed.rejected) ? parsed.rejected : [],
    };
  } catch {
    return { rentals: [], offers: [], rejected: [] };
  }
}

export function RentalManager({ houses, balance, onIncome, onSpend }: Props) {
  const initial = useRef<Persisted | null>(null);
  if (!initial.current) initial.current = readPersisted();

  const [rentals, setRentals] = useState<Rental[]>(initial.current.rentals);
  const [offers, setOffers] = useState<RentalOffer[]>(initial.current.offers);
  const [rejected, setRejected] = useState<string[]>(initial.current.rejected);
  const [open, setOpen] = useState(false);

  const rentalsRef = useRef(rentals);
  rentalsRef.current = rentals;

  const houseEntries = useMemo(
    () => houses.map(([cx, cz, level]) => ({ key: `${cx},${cz}`, level })),
    [houses],
  );

  useEffect(() => {
    const valid = new Map(houseEntries.map((h) => [h.key, h.level]));

    setRentals((prev) =>
      prev
        .filter((r) => valid.has(r.houseKey))
        .map((r) => {
          const level = valid.get(r.houseKey)!;
          return {
            ...r,
            level,
            rent: rentForLevel(level),
            tax: taxForLevel(level),
          };
        }),
    );

    setOffers((prev) => {
      const kept = prev
        .filter((o) => valid.has(o.houseKey))
        .map((o) => {
          const level = valid.get(o.houseKey)!;
          return { ...o, level, rent: rentForLevel(level), tax: taxForLevel(level) };
        });
      const known = new Set([
        ...rentalsRef.current.map((r) => r.houseKey),
        ...kept.map((o) => o.houseKey),
        ...rejected,
      ]);
      const added = houseEntries
        .filter((h) => !known.has(h.key))
        .map((h, i) => makeRentalOffer(h.key, h.level, i));
      return [...kept, ...added];
    });
  }, [houseEntries, rejected]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rentals, offers, rejected }));
    } catch {
      // Le jeu continue même si le stockage local est indisponible.
    }
  }, [rentals, offers, rejected]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const due = rentalsRef.current.filter((r) => now - r.lastPaidAt >= RENT_CYCLE_MS);
      if (!due.length) return;

      due.forEach((r) => onIncome(r.rent, r.tax, `${r.tenant} · maison ${r.houseKey}`));
      setRentals((prev) =>
        prev.map((r) => (now - r.lastPaidAt >= RENT_CYCLE_MS ? { ...r, lastPaidAt: now } : r)),
      );
    }, 4000);
    return () => window.clearInterval(timer);
  }, [onIncome]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRentals((prev) => {
        if (!prev.length || prev.some((r) => r.need)) return prev;
        const index = Math.floor(Math.random() * prev.length);
        return prev.map((r, i) => (i === index ? { ...r, need: makeNeed(Date.now() + i) } : r));
      });
    }, 25_000);
    return () => window.clearInterval(timer);
  }, []);

  const offer = offers[0];

  const acceptOffer = () => {
    if (!offer) return;
    const now = Date.now();
    setRentals((prev) => [
      ...prev,
      {
        houseKey: offer.houseKey,
        level: offer.level,
        tenant: offer.tenant,
        rent: offer.rent,
        tax: offer.tax,
        happiness: 70,
        acceptedAt: now,
        lastPaidAt: now,
      },
    ]);
    setOffers((prev) => prev.slice(1));
  };

  const refuseOffer = () => {
    if (!offer) return;
    setRejected((prev) => [...new Set([...prev, offer.houseKey])]);
    setOffers((prev) => prev.slice(1));
  };

  const resolveNeed = (houseKey: string) => {
    const rental = rentals.find((r) => r.houseKey === houseKey);
    if (!rental?.need) return;
    if (!onSpend(rental.need.cost, `${rental.tenant} · ${rental.need.label}`)) return;
    setRentals((prev) =>
      prev.map((r) =>
        r.houseKey === houseKey
          ? { ...r, happiness: Math.min(100, r.happiness + 8), need: undefined }
          : r,
      ),
    );
  };

  const gross = rentals.reduce((sum, r) => sum + r.rent, 0);
  const taxes = rentals.reduce((sum, r) => sum + r.tax, 0);
  const needs = rentals.filter((r) => r.need).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-16 right-3 z-[65] rounded-full bg-white/90 px-3 py-2 text-[12px] font-extrabold text-slate-900 shadow-lg ring-1 ring-slate-900/10 backdrop-blur sm:bottom-16 sm:right-4"
      >
        🏘️ Locations {needs > 0 ? `💬 ${needs}` : ""}
      </button>

      {offer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-slate-900 shadow-2xl">
            <p className="text-lg font-extrabold">🏠 Proposition de location</p>
            <p className="mt-2 text-sm">
              <strong>{offer.tenant}</strong> souhaite louer la maison <strong>{offer.houseKey}</strong>.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-sky-50 p-2"><b>{offer.rent} €</b><br />loyer</div>
              <div className="rounded-2xl bg-amber-50 p-2"><b>{offer.tax} €</b><br />impôts</div>
              <div className="rounded-2xl bg-emerald-50 p-2"><b>{offer.rent - offer.tax} €</b><br />net</div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Un mois de jeu = environ 60 secondes pour tester le système.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={acceptOffer} className="flex-1 rounded-full bg-emerald-500 px-4 py-2 font-bold text-white">Accepter</button>
              <button type="button" onClick={refuseOffer} className="flex-1 rounded-full bg-slate-200 px-4 py-2 font-bold">Refuser</button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[86vh] w-full max-w-lg flex-col rounded-3xl bg-white p-4 text-slate-900 shadow-2xl">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold">🏘️ Locations & impôts</h2>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-full bg-slate-100 px-3 py-1.5 font-bold">✕</button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-sky-50 p-2"><b>{gross} €</b><br />loyers/mois</div>
              <div className="rounded-2xl bg-amber-50 p-2"><b>{taxes} €</b><br />impôts</div>
              <div className="rounded-2xl bg-emerald-50 p-2"><b>{gross - taxes} €</b><br />net</div>
              <div className="rounded-2xl bg-violet-50 p-2"><b>{balance} €</b><br />solde</div>
            </div>

            <div className="mt-3 overflow-y-auto pr-1">
              {rentals.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Construis une maison puis accepte une proposition de locataire.</p>
              ) : (
                rentals.map((r) => (
                  <div key={r.houseKey} className="mb-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold">👤 {r.tenant}</span>
                      <span className="ml-auto text-xs font-bold">😊 {r.happiness}%</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Maison {r.houseKey} · niveau {r.level} · loyer {r.rent} € · impôts {r.tax} €</p>
                    {r.need && (
                      <div className="mt-2 rounded-2xl bg-white p-2 text-sm shadow-sm ring-1 ring-amber-200">
                        <p>💬 {r.need.icon} {r.need.label}</p>
                        <button type="button" onClick={() => resolveNeed(r.houseKey)} className="mt-2 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-slate-900">
                          Améliorer · {r.need.cost} €
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
