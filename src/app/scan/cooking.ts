// La recette en cours, d'un écran à l'autre (demandé par Hugo le 23 octobre) : l'étape où on en est et le minuteur.
// Gardée sur le téléphone : le minuteur continue si on quitte le mode cuisine, et même si l'appli se ferme.
// À la fin du minuteur : sonnerie, vibration et « Minuteur terminé » sur n'importe quel écran (CookingLive.tsx).
import { useEffect, useState, useSyncExternalStore } from "react";
import type { RecipeState } from "./Recipe";

/** Le minuteur d'une étape. En marche : end (heure de fin). En pause : left (secondes qui restent). */
export type CookTimer = { step: number; label: string; seconds: number; left: number; end: number | null };
export type Cooking = {
  /** L'écran du mode cuisine, et ce qu'il faut pour le rouvrir */
  path: string; state: RecipeState | null;
  title: string; step: number; steps: number;
  timer: CookTimer | null;
  at: number;
};
/** Un minuteur qui vient de finir : la fenêtre « Minuteur terminé » */
export type Ring = { timer: CookTimer; end: number; title: string; path: string; state: RecipeState | null };

const KEY = "frigia.cuisine";
/** Une recette commencée il y a plus de 12 heures est oubliée */
const MAX_AGE = 12 * 3600 * 1000;

function load(): Cooking | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null") as Cooking | null;
    return c && Date.now() - c.at < MAX_AGE ? c : null;
  } catch { return null; }
}

let cooking: Cooking | null = load();
let ring: Ring | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const getCooking = () => cooking;
export function setCooking(c: Cooking | null) {
  cooking = c;
  try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* navigation privée */ }
  emit();
}
export function patchCooking(patch: Partial<Cooking>) {
  if (cooking) setCooking({ ...cooking, ...patch, at: Date.now() });
}
export const useCooking = () => useSyncExternalStore(subscribe, () => cooking);
export const useRing = () => useSyncExternalStore(subscribe, () => ring);

/** Secondes qui restent */
export const timeLeft = (t: CookTimer, now = Date.now()) => (t.end == null ? t.left : Math.max(0, Math.ceil((t.end - now) / 1000)));
export const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Un seul minuteur à la fois : en démarrer un autre remplace le précédent */
export function startTimer(t: Omit<CookTimer, "end">) {
  primeAlarm();
  patchCooking({ timer: { ...t, end: Date.now() + t.left * 1000 } });
}
export function pauseTimer() {
  const t = cooking?.timer;
  if (t && t.end != null) patchCooking({ timer: { ...t, left: timeLeft(t), end: null } });
}

/** Le minuteur est arrivé à zéro : il s'arrête et sonne */
export function fireTimer() {
  const c = cooking, t = c?.timer;
  if (!c || !t || t.end == null) return;
  ring = { timer: t, end: t.end, title: c.title, path: c.path, state: c.state };
  setCooking({ ...c, timer: null });
  stopSound = playAlarm();
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  // Appli en arrière-plan (Android surtout) : la notif du téléphone, si elles sont autorisées
  if (document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
    void navigator.serviceWorker?.getRegistration().then(reg => reg?.showNotification("Minuteur terminé", {
      body: `${t.label} · ${c.title}`, icon: "/icon-192.png", tag: "frigia-minuteur", data: { url: c.path },
    })).catch(() => undefined);
  }
}
export function closeRing() {
  stopSound();
  ring = null;
  emit();
}
/** « Encore 1 min » : le même minuteur repart pour une minute */
export function oneMore() {
  const r = ring;
  closeRing();
  if (r && cooking?.path === r.path) startTimer({ ...r.timer, seconds: 60, left: 60 });
}

/** Relance l'affichage toutes les ms tant que active (compte à rebours) */
export function useNow(active: boolean, ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

// ── Sonnerie ─────────────────────────────────────────────────────────────────
// Trois notes, répétées pendant 20 secondes ou jusqu'à « C'est bon ». Pas de fichier son : le téléphone les joue.
// L'iPhone ne joue un son que si on a touché l'écran avant : le son est préparé quand on touche « Démarrer ».
type AudioSession = { type: string };
let ctx: AudioContext | null = null;
let stopSound = () => {};

export function primeAlarm() {
  try {
    // Safari : sonner même en mode silencieux
    const s = (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
    if (s) s.type = "playback";
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch { /* pas de son sur ce navigateur */ }
}

function note(a: AudioContext, at: number, freq: number) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + 0.65);
}

function playAlarm(): () => void {
  stopSound();
  try {
    ctx ??= new AudioContext();
    const a = ctx;
    void a.resume();
    const play = () => { const t0 = a.currentTime + 0.05; note(a, t0, 880); note(a, t0 + 0.2, 1109); note(a, t0 + 0.4, 1319); };
    play();
    let n = 0;
    const t = setInterval(() => { if (++n >= 12) clearInterval(t); else play(); }, 1700);
    return () => clearInterval(t);
  } catch { return () => {}; }
}
