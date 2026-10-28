// Notifications (étape 12, migration 20261021000000_notifications.sql) :
// le centre (table notifications), les réglages (notif_settings), ce téléphone (Web Push, api/notify.ts).
import { useSyncExternalStore } from "react";
import { supabase } from "../supabase";
import { postApi } from "./api";

export type NotifKind = "evening" | "week" | "referral" | "scans" | "report" | "welcome" | "list";
export type Notif = { id: string; kind: NotifKind; title: string; body: string; url: string | null; action: string | null; date: Date; read: boolean };
export type NotifSettings = { evening: boolean; week: boolean; news: boolean };
export const DEFAULT_SETTINGS: NotifSettings = { evening: true, week: true, news: false };

type Row = { id: string; kind: NotifKind; title: string; body: string; url: string | null; action: string | null; created_at: string; read_at: string | null };
const fromRow = (r: Row): Notif => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, url: r.url, action: r.action, date: new Date(r.created_at), read: !!r.read_at });

// ─── Le centre : gardé en mémoire, partagé par la cloche de l'accueil et l'écran des notifs ───
let owner: string | null = null;
let items: Notif[] | null = null;
const listeners = new Set<() => void>();
const set = (v: Notif[] | null) => { items = v; listeners.forEach(f => f()); };
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/** null : pas encore chargé (ou pas de table) */
export const useNotifs = () => useSyncExternalStore(subscribe, () => items);

export async function refreshNotifs(userId: string) {
  if (owner !== userId) { owner = userId; set(null); }
  const { data, error } = await supabase.from("notifications").select("id, kind, title, body, url, action, created_at, read_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  // Sans la table (migration pas lancée) : un centre vide
  if (owner === userId) set(!error && data ? (data as Row[]).map(fromRow) : items ?? []);
}

export function markRead(ids: string[]) {
  // Centre pas encore chargé (notif ouverte depuis le téléphone) : on écrit quand même
  const todo = items ? ids.filter(id => items?.some(n => n.id === id && !n.read)) : ids;
  if (!todo.length) return;
  set(items?.map(n => (todo.includes(n.id) ? { ...n, read: true } : n)) ?? null);
  void supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", todo).then(() => undefined);
}

export function removeNotif(id: string) {
  set(items?.filter(n => n.id !== id) ?? null);
  void supabase.from("notifications").delete().eq("id", id).then(() => undefined);
}

/** « Bienvenue » : le seul message que le compte écrit lui-même, une fois */
export async function addWelcome(userId: string) {
  await supabase.from("notifications").upsert(
    { user_id: userId, kind: "welcome", key: "welcome", title: "Bienvenue", body: "Ton premier scan t'attend : ouvre ton frigo, on s'occupe du reste." },
    { onConflict: "user_id,key", ignoreDuplicates: true },
  );
}

// ─── Les réglages ───
/** null : la table ne répond pas */
export async function fetchNotifSettings(userId: string): Promise<NotifSettings | null> {
  const { data, error } = await supabase.from("notif_settings").select("evening, week, news").eq("user_id", userId).maybeSingle();
  if (error) return null;
  return data ? (data as NotifSettings) : DEFAULT_SETTINGS;
}
export async function saveNotifSettings(userId: string, s: NotifSettings): Promise<boolean> {
  const { error } = await supabase.from("notif_settings").upsert({ user_id: userId, ...s, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return !error;
}

// ─── Ce téléphone ───
/** on : il sonne. off : pas encore activées. denied : refusées dans le téléphone. unsupported : ce navigateur ne sait pas (iPhone hors écran d'accueil…) */
export type PushState = "on" | "off" | "denied" | "unsupported";

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);
const registration = () => withTimeout(navigator.serviceWorker.ready, 8000);

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) ? "on" : "off";
  } catch { return "off"; }
}

const toKey = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

/** Abonne ce téléphone et le dit au serveur. quiet : sans la notif « C'est activé » */
async function register(quiet: boolean) {
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const r = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "key" }) });
    const { key } = await r.json() as { key?: string };
    if (!key) throw new Error("no key");
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
  }
  const res = await postApi("/api/notify", { action: "subscribe", sub: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, quiet });
  if (!res.ok) throw new Error("subscribe failed");
}

/** « Activer » : la fenêtre du téléphone, puis l'abonnement. error : autorisé, mais l'abonnement n'a pas pu se faire */
export async function enablePush(): Promise<PushState | "error"> {
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  try { await register(false); return "on"; } catch { return "error"; }
}

/** Une fois par jour : le serveur garde le bon téléphone et le bon fuseau */
export async function resyncPush(userId: string) {
  const k = `frigia_push_sync_${userId}`, today = new Date().toDateString();
  try { if (localStorage.getItem(k) === today) return; } catch { /* navigation privée */ }
  if ((await pushState()) !== "on") return;
  try {
    await register(true);
    try { localStorage.setItem(k, today); } catch { /* navigation privée */ }
  } catch { /* on réessaiera */ }
}

// L'écran « On te fait signe au bon moment ? » après le premier repas cuisiné : une seule fois
const ASKED = "frigia_nf_asked";
export const notifAsked = () => { try { return !!localStorage.getItem(ASKED); } catch { return true; } };
export const setNotifAsked = () => { try { localStorage.setItem(ASKED, "1"); } catch { /* navigation privée */ } };
