import { LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";

const SESSION_KEY = "tikowiko-security-unlocked";

export default function SecurityGate({ children }: { children: ReactNode }) {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(SESSION_KEY) === "1");
    } catch {
      // sessionStorage may be unavailable in a restricted webview.
    }
  }, []);

  useEffect(() => {
    if (!blockedUntil) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= blockedUntil) {
        setBlockedUntil(0);
        setError("");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [blockedUntil]);

  if (unlocked) return <>{children}</>;

  const blocked = blockedUntil > now;
  const remainingSeconds = Math.max(0, Math.ceil((blockedUntil - now) / 1000));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (blocked) {
      setError(`Trop d'essais. Réessaie dans ${remainingSeconds} seconde${remainingSeconds > 1 ? "s" : ""}.`);
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError("Entre le code à 6 chiffres.");
      return;
    }

    setChecking(true);
    try {
      const response = await fetch("/api/security/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { valid?: boolean; retryLater?: boolean };

      if (data.valid) {
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // Unlock still works for the current render even without storage.
        }
        setUnlocked(true);
        setAttempts(0);
        return;
      }

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setCode("");

      if (response.status === 429 || data.retryLater || nextAttempts >= 5) {
        const until = Date.now() + 60_000;
        setNow(Date.now());
        setBlockedUntil(until);
        setAttempts(0);
        setError("Trop d'essais. Le cadenas est bloqué pendant 60 secondes.");
      } else {
        setError("Code incorrect.");
      }
    } catch {
      setError("Impossible de vérifier le code. Vérifie ta connexion Internet.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <LockKeyhole className="h-8 w-8" aria-hidden="true" />
        </div>

        <div className="mt-5 text-center">
          <h1 className="text-2xl font-bold tracking-tight">TikoWiko Security</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre ton code fixe à 6 chiffres pour ouvrir TikowikoCity.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="sr-only">Code de sécurité à 6 chiffres</span>
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              className="h-16 w-full rounded-2xl border border-input bg-background px-4 text-center font-mono text-3xl font-bold tracking-[0.35em] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
              autoFocus
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-center text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={checking || code.length !== 6 || blocked}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            {checking ? "Vérification…" : "Déverrouiller"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Ton code est fixe et n'est pas enregistré dans l'application.
        </p>
      </section>
    </main>
  );
}
