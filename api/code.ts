// Codes ami et créateur, parrainage (migration 20261020000000_codes.sql).
// action « check » : le code existe-t-il ? (à l'inscription, avant le compte : sans jeton)
// action « redeem » : l'utiliser sur ce compte (10 scans en plus ; mois offert d'un créateur au premier abonnement)
// action « mine » : mon code ami, créé au premier appel, et les amis venus avec lui.
// Pas de « tu voulais dire » ni de liste : on ne laisse pas deviner les codes des autres. 20 essais par heure.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { adminClient, authUser, preflight, type Req, type Res } from "./_shared.js";

const ATTEMPTS = 20;
const WINDOW_S = 3600;
const SUFFIX = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

type Code = { code: string; kind: "friend" | "creator"; owner: string | null; creator: string | null; bonus_scans: number; plus_days: number; expires_at: string | null };

const clean = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase().replace(/\s+/g, "") : "");
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

async function firstName(admin: SupabaseClient, id: string): Promise<string> {
  const { data } = await admin.from("profiles").select("first_name").eq("id", id).maybeSingle();
  return ((data?.first_name as string | null) ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Ce que le code donne, en une phrase */
async function perk(admin: SupabaseClient, c: Code): Promise<string> {
  const scans = `${c.bonus_scans} scans gratuits en plus`;
  if (c.kind === "friend") {
    const n = c.owner ? await firstName(admin, c.owner) : "";
    return `${n ? `Code de ${n}` : "Code ami"} : ${scans}.`;
  }
  return `Code ${c.code} : ${scans}${c.plus_days ? ", et 1 mois de Plus offert : 3 mois pour 13,98 €, puis 6,99 €/mois" : ""}.`;
}

/** Ce que voit la personne : ok (avec ce que le code donne), introuvable, expiré, le sien, ou déjà un code */
async function verdict(admin: SupabaseClient, user: User | null, code: string) {
  const { data } = await admin.from("codes").select("*").eq("code", code).maybeSingle();
  const c = data as Code | null;
  if (!c) return { status: "unknown" };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { status: "expired", since: DATE.format(new Date(c.expires_at)) };
  if (user && c.owner === user.id) return { status: "own" };
  if (user) {
    const { data: used } = await admin.from("code_uses").select("code").eq("user_id", user.id).maybeSingle();
    if (used) return { status: "already", code: used.code };
  }
  return { status: "ok", perk: await perk(admin, c), c };
}

/** Le code ami du compte : 4 lettres du prénom et 4 au hasard (CAMI-R7Q4) */
async function myCode(admin: SupabaseClient, user: User): Promise<string | null> {
  const { data } = await admin.from("codes").select("code").eq("owner", user.id).eq("kind", "friend").maybeSingle();
  if (data) return data.code as string;
  const name = (await firstName(admin, user.id)) || (user.email ?? "").split("@")[0];
  const letters = name.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
  const prefix = letters.length >= 2 ? letters : "AMI";
  for (let i = 0; i < 5; i++) {
    const code = `${prefix}-${Array.from({ length: 4 }, () => SUFFIX[randomInt(SUFFIX.length)]).join("")}`;
    const { error } = await admin.from("codes").insert({ code, kind: "friend", owner: user.id });
    if (!error) return code;
    // Créé en même temps par un autre appel : on le relit
    const { data: again } = await admin.from("codes").select("code").eq("owner", user.id).eq("kind", "friend").maybeSingle();
    if (again) return again.code as string;
  }
  return null;
}

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const { action, code: raw } = (req.body ?? {}) as { action?: string; code?: string };
  const admin = adminClient();
  const user = await authUser(req, admin);

  if (action === "mine") {
    if (!user) return res.status(401).json({ error: "Invalid token" });
    const code = await myCode(admin, user);
    if (!code) return res.status(503).json({ error: "Codes indisponibles" });
    const { data } = await admin.from("code_uses").select("user_id, used_at, subscribed_at, rewarded_at")
      .eq("referrer", user.id).order("used_at", { ascending: false }).limit(100);
    const rows = (data ?? []) as { user_id: string; used_at: string; subscribed_at: string | null; rewarded_at: string | null }[];
    // Le prénom seulement, jamais l'email
    const names = new Map<string, string>();
    if (rows.length) {
      const { data: p } = await admin.from("profiles").select("id, first_name").in("id", rows.map(r => r.user_id));
      for (const x of (p ?? []) as { id: string; first_name: string | null }[]) names.set(x.id, (x.first_name ?? "").trim().split(/\s+/)[0] ?? "");
    }
    return res.json({
      code,
      months: rows.filter(r => r.rewarded_at).length,
      invites: rows.map(r => ({ name: names.get(r.user_id) || "Un ami", usedAt: r.used_at, subscribedAt: r.rewarded_at ?? null })),
    });
  }

  if (action !== "check" && action !== "redeem") return res.status(400).json({ error: "Unknown action" });
  const code = clean(raw);
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return res.json({ status: "unknown" });
  if (action === "redeem" && !user) return res.status(401).json({ error: "Invalid token" });

  const ip = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || "?";
  const { data: allowed, error: rlError } = await admin.rpc("check_code_attempt", { p_key: user ? `u:${user.id}` : `ip:${ip}`, p_limit: ATTEMPTS, p_window_seconds: WINDOW_S });
  if (rlError) return res.status(503).json({ error: "Codes indisponibles" });
  if (!allowed) return res.status(429).json({ error: "Trop d'essais. Réessaie dans une heure." });

  const v = await verdict(admin, user, code);
  if (action === "check" || v.status !== "ok" || !user) {
    return res.json({ ...v, c: undefined });
  }
  const { data: status, error } = await admin.rpc("redeem_code", { p_user_id: user.id, p_code: code });
  if (error) return res.status(503).json({ error: "Codes indisponibles" });
  if (status !== "ok") return res.json({ status });
  res.json({ status: "ok", perk: v.perk, bonus: v.c?.bonus_scans ?? 0, offer: (v.c?.plus_days ?? 0) > 0 });
}
