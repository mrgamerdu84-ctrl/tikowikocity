import { useState } from "react";

import { AVATARS, savePlayer } from "@/lib/player";

export default function PlayerSetup({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const [error, setError] = useState("");

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 20);
    if (clean.length < 2) {
      setError("Choisis un pseudo d'au moins 2 caractères.");
      return;
    }
    savePlayer({ name: clean, avatarId });
    onDone?.();
  };

  return (
    <section className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[linear-gradient(180deg,var(--sky-top),var(--sky-mid)_55%,var(--sky-bottom))] p-4">
      <form
        onSubmit={start}
        className="w-full max-w-[520px] rounded-3xl bg-white/92 p-5 text-ink shadow-[0_18px_50px_rgba(6,58,94,0.25)] ring-1 ring-ink/10 backdrop-blur sm:p-7"
      >
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] opacity-70">
          Nouvelle partie
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
          🫧 TikowikoCarWash
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed opacity-80">
          Tu débarques dans une petite ville paumée où un car wash à l'abandon n'attend que toi.
          Crée ton personnage pour commencer.
        </p>

        <label htmlFor="pseudo" className="mt-5 block text-[13px] font-bold uppercase tracking-wide opacity-80">
          Ton pseudo
        </label>
        <input
          id="pseudo"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          maxLength={20}
          autoComplete="nickname"
          placeholder="Ex. Tikowiko"
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-splash focus:ring-2 focus:ring-splash/40"
        />

        <p className="mt-5 text-[13px] font-bold uppercase tracking-wide opacity-80">Ton avatar</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAvatarId(a.id)}
              aria-pressed={avatarId === a.id}
              title={a.label}
              className={`rounded-2xl p-1 transition-all ${
                avatarId === a.id
                  ? "bg-splash/25 ring-2 ring-splash scale-[1.04]"
                  : "bg-white/70 ring-1 ring-ink/10 hover:bg-white"
              }`}
            >
              <img
                src={a.src}
                alt={`Avatar ${a.label}`}
                loading="lazy"
                width={512}
                height={512}
                className="aspect-square w-full rounded-xl object-contain"
              />
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-[13px] font-semibold text-red-600">{error}</p>}

        <button
          type="submit"
          className="mt-6 w-full rounded-2xl bg-splash px-4 py-3 text-[15px] font-black tracking-wide text-splash-foreground shadow-[0_8px_22px_rgba(6,58,94,0.22)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          🚗 Commencer la partie
        </button>
        <p className="mt-3 text-center text-[11.5px] opacity-70">
          © {new Date().getFullYear()} tikowikoFamily
        </p>
      </form>
    </section>
  );
}
