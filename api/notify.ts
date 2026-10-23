// Notifications (étape 12, migration 20261021000000_notifications.sql, envoi dans api/_push.ts).
// POST action « key » : la clé publique pour s'abonner (sans compte).
// POST action « subscribe » : ce téléphone reçoit les notifs du compte (avec son fuseau) ; « C'est activé » part tout de suite.
// POST action « unsubscribe » : ce téléphone ne reçoit plus rien.
// GET ?job=evening : l'idée du soir (tous les jours vers 18 h) et, les 3 premiers jours du mois, « Ton bilan est prêt ».
// GET ?job=week : « On prépare ta semaine ? » (le dimanche matin).
// Les GET viennent des crons Vercel (vercel.json) avec « Authorization: Bearer CRON_SECRET ».
// Vercel ne lance les crons que sur le site en production, pas sur les aperçus.
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyMany, payloadOf, sendPush, vapidPublicKey, type Notif, type Sub } from "./_push.js";
import { adminClient, authUser, errorMessage, isPlus, preflight, type Req, type Res } from "./_shared.js";

const DAY = 864e5;
const iso = (t: number) => new Date(t).toISOString();
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Le fuseau du téléphone s'il est valable, sinon Paris */
export function safeTz(tz: unknown): string {
  if (typeof tz === "string" && tz.length <= 60) {
    try { new Intl.DateTimeFormat("fr-FR", { timeZone: tz }); return tz; } catch { /* inconnu */ }
  }
  return "Europe/Paris";
}
/** « 2026-10-14 » dans ce fuseau */
const dayOf = (t: number | string, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
const norm = (s: string) => s.trim().toLowerCase();
const clip = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

type Settings = { user_id: string; evening: boolean; week: boolean; tz: string };
type Recipe = { title?: string; minutes?: number; missing?: string };
type Scan = { id: string; user_id: string; scan_date: string; recipes: Recipe[] | null };
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** Toutes les lignes, par pages de 1000 (la limite de Supabase) */
async function all<T>(page: (from: number, to: number) => Page<T>, max = 50000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
async function byIds<T>(ids: string[], page: (chunk: string[]) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 300) out.push(...((await page(ids.slice(i, i + 300))).data ?? []));
  return out;
}
const group = <T, K>(rows: T[], key: (r: T) => K) => {
  const m = new Map<K, T[]>();
  for (const r of rows) { const k = key(r); const l = m.get(k); if (l) l.push(r); else m.set(k, [r]); }
  return m;
};

/** Les comptes à qui on peut écrire : un téléphone abonné, ou un scan récent (la notif attend alors dans le centre) */
async function audience(admin: SupabaseClient, now: number, scanDays: number) {
  const [subRows, scans] = await Promise.all([
    all<Sub & { user_id: string }>((a, b) => admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").range(a, b)),
    all<Scan>((a, b) => admin.from("user_history").select("id, user_id, scan_date, recipes")
      .gte("scan_date", iso(now - scanDays * DAY)).order("scan_date", { ascending: false }).range(a, b)),
  ]);
  const subs = group(subRows, s => s.user_id);
  const lastScan = new Map<string, Scan>();
  for (const s of scans) if (!lastScan.has(s.user_id)) lastScan.set(s.user_id, s);
  const users = [...new Set([...subs.keys(), ...lastScan.keys()])];
  const settings = new Map((await byIds<Settings>(users, c => admin.from("notif_settings").select("user_id, evening, week, tz").in("user_id", c))).map(s => [s.user_id, s]));
  return { subs, lastScan, users, settings };
}

/** « Tu as tout dans le frigo. 25 minutes, et c'est prêt. » */
export function eveningBody(r: Recipe): string {
  const have = r.missing === undefined || r.missing === null ? "Avec ce qu'il y a dans ton frigo." : r.missing.trim() ? `Il te manque juste ${r.missing.trim()}.` : "Tu as tout dans le frigo.";
  return r.minutes && r.minutes > 0 ? `${have} ${Math.round(r.minutes)} minutes, et c'est prêt.` : have;
}

/** Peut-il scanner ? (Plus, ou encore dans ses jours d'essai) */
async function canScan(admin: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const ok = new Set<string>();
  for (const id of ids) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data.user && isPlus(data.user)) ok.add(id);
  }
  return ok;
}

/** L'idée du soir : une recette du dernier scan (3 jours au plus), pas encore cuisinée. Rien si un repas est déjà cuisiné aujourd'hui. */
async function evening(admin: SupabaseClient, now = Date.now()) {
  const { subs, lastScan, users, settings } = await audience(admin, now, 3);
  const [cooked, recent] = await Promise.all([
    all<{ user_id: string; recipe_title: string; cooked_at: string }>((a, b) => admin.from("cooked_meals").select("user_id, recipe_title, cooked_at").gte("cooked_at", iso(now - 4 * DAY)).range(a, b)),
    // Les relances sans scan : une tous les 3 jours au plus
    all<{ user_id: string }>((a, b) => admin.from("notifications").select("user_id").eq("kind", "evening").gte("created_at", iso(now - 3 * DAY + 3 * 3600e3)).range(a, b)),
  ]);
  const cookedBy = group(cooked, c => c.user_id);
  const lately = new Set(recent.map(r => r.user_id));
  const list: { userId: string; n: Notif; push: boolean }[] = [];
  const nudge: { userId: string; key: string }[] = [];

  for (const u of users) {
    const s = settings.get(u);
    if (s && !s.evening) continue;
    const tz = safeTz(s?.tz), today = dayOf(now, tz), key = `evening:${today}`;
    const mine = cookedBy.get(u) ?? [];
    if (mine.some(c => dayOf(c.cooked_at, tz) === today)) continue;
    const scan = lastScan.get(u);
    const done = new Set(mine.map(c => norm(c.recipe_title)));
    const ideas = (scan?.recipes ?? []).map((r, i) => ({ r, i })).filter(x => x.r?.title && !done.has(norm(x.r.title!)));
    if (scan && ideas.length) {
      // Une autre recette du scan chaque jour
      const { r, i } = ideas[Math.max(0, Math.floor((now - Date.parse(scan.scan_date)) / DAY)) % ideas.length];
      list.push({ userId: u, push: true, n: { kind: "evening", key, title: `${clip(r.title!.trim())} ce soir ?`, body: eveningBody(r), url: `/recettes/${encodeURIComponent(scan.id)}/${i}`, action: "Voir la recette" } });
    } else if (subs.has(u) && !lately.has(u)) nudge.push({ userId: u, key });
  }
  const able = nudge.length ? await canScan(admin, nudge.map(x => x.userId)) : new Set<string>();
  for (const x of nudge) {
    if (able.has(x.userId)) list.push({ userId: x.userId, push: true, n: { kind: "evening", key: x.key, title: "Qu'est-ce qu'on mange ce soir ?", body: "Prends ton frigo en photo : 3 idées avec ce qu'il te reste.", url: "/scan", action: "Scanner mon frigo" } });
  }
  const sent = await notifyMany(admin, list, subs);
  return { evening: sent, report: await monthReport(admin, now) };
}

/** Les 3 premiers jours du mois : « Ton bilan de septembre est prêt », pour ceux qui ont cuisiné le mois d'avant. Dans le centre seulement. */
async function monthReport(admin: SupabaseClient, now: number) {
  const [y, m, d] = dayOf(now, "Europe/Paris").split("-").map(Number);
  if (d > 3) return 0;
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const month = `${py}-${String(pm).padStart(2, "0")}`;
  const rows = await all<{ user_id: string; kg: number | string; cooked_at: string }>((a, b) => admin.from("cooked_meals").select("user_id, kg, cooked_at")
    .gte("cooked_at", iso(Date.UTC(py, pm - 1, 1) - DAY)).lt("cooked_at", iso(Date.UTC(y, m - 1, 1) + DAY)).range(a, b));
  const name = MONTHS[pm - 1];
  const of = /^[aeiouâ]/.test(name) ? `d'${name}` : `de ${name}`;
  const list = [...group(rows.filter(r => dayOf(r.cooked_at, "Europe/Paris").startsWith(month)), r => r.user_id)].map(([userId, meals]) => ({
    userId, push: false,
    n: {
      kind: "report", key: `report:${month}`, title: `Ton bilan ${of} est prêt`, url: `/bilan?mois=${month}`,
      // « Sauvé » seulement si quelque chose marqué « À finir » a été cuisiné ce mois-là
      body: meals.some(r => Number(r.kg) > 0) ? `Ce que tu as cuisiné et sauvé en ${name}.` : `Ce que tu as cuisiné avec ton frigo en ${name}.`,
    } satisfies Notif,
  }));
  return notifyMany(admin, list);
}

/** Le dimanche matin : « On prépare ta semaine ? » */
async function week(admin: SupabaseClient, now = Date.now()) {
  const { subs, lastScan, users, settings } = await audience(admin, now, 7);
  const list = users.filter(u => settings.get(u)?.week !== false).map(u => ({
    userId: u, push: true,
    n: {
      kind: "week", key: `week:${dayOf(now, safeTz(settings.get(u)?.tz))}`, title: "On prépare ta semaine ?",
      body: lastScan.has(u) ? "Des repas avec ton dernier scan. Ce qui se périme passe en premier." : "Un scan du frigo, et on te propose les repas de la semaine.",
      url: "/planning/creer", action: "Préparer ma semaine",
    } satisfies Notif,
  }));
  return { week: await notifyMany(admin, list, subs) };
}

export default async function handler(req: Req, res: Res) {
  if (req.method === "GET") {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
    const job = req.query?.job;
    try {
      if (job === "evening") return res.json(await evening(adminClient()));
      if (job === "week") return res.json(await week(adminClient()));
    } catch (e) {
      console.error("notify job failed:", job, errorMessage(e));
      return res.status(500).json({ error: errorMessage(e) });
    }
    return res.status(400).json({ error: "Unknown job" });
  }

  if (preflight(req, res)) return;
  const { action, sub, tz, endpoint, quiet } = (req.body ?? {}) as { action?: string; quiet?: boolean; sub?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; tz?: unknown; endpoint?: unknown };
  if (action === "key") {
    const key = vapidPublicKey();
    return key ? res.json({ key }) : res.status(503).json({ error: "Notifications indisponibles" });
  }

  const admin = adminClient();
  const user = await authUser(req, admin);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  if (action === "subscribe") {
    const e = sub?.endpoint, p = sub?.keys?.p256dh, a = sub?.keys?.auth;
    if (typeof e !== "string" || !/^https:\/\//.test(e) || e.length > 1000 || typeof p !== "string" || p.length > 200 || typeof a !== "string" || a.length > 100) {
      return res.status(400).json({ error: "Abonnement invalide" });
    }
    // Un téléphone qui change de compte passe au nouveau
    const { error } = await admin.from("push_subscriptions").upsert({ endpoint: e, user_id: user.id, p256dh: p, auth: a }, { onConflict: "endpoint" });
    if (error) return res.status(503).json({ error: "Notifications indisponibles" });
    await admin.from("notif_settings").upsert({ user_id: user.id, tz: safeTz(tz), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    // Une fois par jour l'appli redit son abonnement (quiet) : pas de notif alors
    if (quiet) return res.json({ ok: true, sent: 0 });
    const sent = await sendPush(admin, [{ endpoint: e, p256dh: p, auth: a }], payloadOf({ kind: "welcome", key: "on", title: "C'est activé", body: "On te fait signe au bon moment. Tu choisis lesquelles dans les réglages." }));
    return res.json({ ok: true, sent });
  }

  if (action === "unsubscribe") {
    if (typeof endpoint === "string") await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
    return res.json({ ok: true });
  }

  res.status(400).json({ error: "Unknown action" });
}
