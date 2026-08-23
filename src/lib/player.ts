import { useEffect, useState } from "react";

import avatar1 from "@/assets/avatar-1.png";
import avatar2 from "@/assets/avatar-2.png";
import avatar3 from "@/assets/avatar-3.png";
import avatar4 from "@/assets/avatar-4.png";
import avatar5 from "@/assets/avatar-5.png";
import avatar6 from "@/assets/avatar-6.png";

export type Avatar = { id: string; label: string; src: string };

const AVATAR_LIST = [
  { id: "leo", label: "Léo", src: avatar1 },
  { id: "mila", label: "Mila", src: avatar2 },
  { id: "gaston", label: "Gaston", src: avatar3 },
  { id: "nina", label: "Nina", src: avatar4 },
  { id: "sami", label: "Sami", src: avatar5 },
  { id: "bulbo", label: "Bulbo", src: avatar6 },
] as const satisfies readonly Avatar[];

export const AVATARS: readonly Avatar[] = AVATAR_LIST;
const DEFAULT_AVATAR: Avatar = AVATAR_LIST[0];

export type Player = { name: string; avatarId: string };

const KEY = "tikowiko.player.v1";
const EVENT = "tikowiko:player";

export function avatarSrc(avatarId: string): string {
  return (AVATARS.find((a) => a.id === avatarId) ?? DEFAULT_AVATAR).src;
}

export function loadPlayer(): Player | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Player>;
    if (typeof parsed?.name !== "string" || !parsed.name.trim()) return null;
    return {
      name: parsed.name.trim().slice(0, 20),
      avatarId: typeof parsed.avatarId === "string" ? parsed.avatarId : DEFAULT_AVATAR.id,
    };
  } catch {
    return null;
  }
}

export function savePlayer(player: Player) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(player));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function clearPlayer() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Reads the saved player. `ready` is false until hydration finished. */
export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setPlayer(loadPlayer());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { player, ready };
}
