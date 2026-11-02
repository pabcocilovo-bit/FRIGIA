// Le dashboard de suivi > Réseaux : les comptes TikTok liés (Login Kit, API v2).
// 1. L'admin demande un lien (pour son compte ou pour un créateur) : l'adresse d'autorisation TikTok, avec un « state » signé.
// 2. Le propriétaire autorise Frigia ; TikTok revient sur /admin?code=…&state=… (src/app/admin/Callback.tsx),
//    qui envoie le code ici sans compte Frigia : le state signé fait foi.
// 3. Chaque matin (cron de api/subscription.ts) ou sur « Actualiser » : abonnés, j'aime, vidéos et vues → social_stats.
// Vercel : TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET (ceux du Sandbox pour tester, ceux de Production après validation).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com/v2";
// user.info.profile donne le nom du compte (@…) ; sans lui, le nom affiché
const SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];
// Les adresses de retour déclarées dans Login Kit (elles doivent correspondre exactement)
const ORIGINS = [
  "https://frigia.fr",
  "https://frigia-git-claude-project-thread-mvttbl-pablo-s-projects16.vercel.app",
  ...(process.env.TIKTOK_REDIRECT_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean),
];
const DAY_S = 86_400;
// Un lien pour un créateur reste valable 7 jours
const LINK_TTL_S = 7 * DAY_S;

export const tiktokReady = () => !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);

const secret = () => process.env.SCAN_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sign = (payload: string) => createHmac("sha256", secret()).update(`tiktok:${payload}`).digest("base64url");

type State = { kind: "frigia" | "createur"; exp: number; origin: string };

function makeState(s: State): string {
  const payload = Buffer.from(JSON.stringify({ ...s, n: randomBytes(6).toString("base64url") })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readState(state: unknown): State | null {
  if (typeof state !== "string" || !secret()) return null;
  const [p, s] = state.split(".");
  if (!p || !s) return null;
  const a = Buffer.from(sign(p)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const st = JSON.parse(Buffer.from(p, "base64url").toString()) as State;
    return st.exp * 1000 > Date.now() && ORIGINS.includes(st.origin) ? st : null;
  } catch { return null; }
}

/** L'adresse à ouvrir pour autoriser Frigia : null si l'origine n'est pas déclarée */
export function tiktokLink(kind: unknown, origin: unknown): string | null {
  if (typeof origin !== "string" || !ORIGINS.includes(origin)) return null;
  const k = kind === "createur" ? "createur" : "frigia";
  // Le compte de Frigia : l'admin autorise tout de suite. Un créateur : le temps qu'il ouvre le lien.
  const exp = Math.floor(Date.now() / 1000) + (k === "createur" ? LINK_TTL_S : 3600);
  const q = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!, scope: SCOPES.join(","), response_type: "code",
    redirect_uri: `${origin}/admin`, state: makeState({ kind: k, exp, origin }),
  });
  return `${AUTH_URL}?${q}`;
}

type Token = { access_token: string; refresh_token?: string; expires_in: number; refresh_expires_in?: number; open_id: string; scope?: string };

async function tokenRequest(params: Record<string, string>): Promise<Token> {
  const r = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await r.json().catch(() => ({})) as Partial<Token> & { error?: string; error_description?: string };
  if (!r.ok || body.error || !body.access_token || !body.open_id) throw new Error(`token: ${body.error_description || body.error || r.status}`);
  return body as Token;
}

type TikTokVideo = {
  id: string; title?: string; video_description?: string; create_time?: number; cover_image_url?: string; share_url?: string;
  duration?: number; view_count?: number; like_count?: number; comment_count?: number; share_count?: number;
};
const VIDEO_FIELDS = "id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count";

type TikTokUser = { open_id: string; username?: string; display_name?: string; follower_count?: number; likes_count?: number; video_count?: number };

async function api<T>(path: string, token: string, init?: { body: unknown }): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: init ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init ? { "Content-Type": "application/json" } : {}) },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await r.json().catch(() => ({})) as { data?: T; error?: { code?: string; message?: string } };
  if (!r.ok || (body.error?.code && body.error.code !== "ok")) throw new Error(`${path}: ${body.error?.message || body.error?.code || r.status}`);
  return body.data as T;
}

/** Les chiffres du compte : ceux du profil, et la somme des vues de toutes ses vidéos publiques */
async function fetchStats(token: string, scopes: string) {
  const fields = ["open_id", "display_name", "follower_count", "likes_count", "video_count", ...(scopes.includes("user.info.profile") ? ["username"] : [])];
  const { user } = await api<{ user: TikTokUser }>(`/user/info/?fields=${fields.join(",")}`, token);
  const videos: TikTokVideo[] = [];
  let cursor: number | undefined;
  // 20 vidéos par page, 50 pages au plus (1 000 vidéos)
  for (let page = 0; page < 50; page++) {
    const d = await api<{ videos?: TikTokVideo[]; cursor?: number; has_more?: boolean }>(
      `/video/list/?fields=${VIDEO_FIELDS}`, token, { body: { max_count: 20, ...(cursor ? { cursor } : {}) } });
    videos.push(...(d.videos ?? []));
    if (!d.has_more || !d.cursor) break;
    cursor = d.cursor;
  }
  return { user, videos, views: videos.reduce((t, v) => t + (v.view_count ?? 0), 0) };
}

const handleOf = (u: TikTokUser) => (u.username || u.display_name || u.open_id).replace(/^@/, "").replace(/\s+/g, "_").slice(0, 80);
const today = () => new Date().toISOString().slice(0, 10);
const expiresAt = (s: number | undefined) => (s ? new Date(Date.now() + s * 1000).toISOString() : null);

async function saveStats(admin: SupabaseClient, accountId: string, s: Awaited<ReturnType<typeof fetchStats>>) {
  const { error } = await admin.from("social_stats").upsert({
    account_id: accountId, day: today(), source: "api", updated_at: new Date().toISOString(),
    followers: s.user.follower_count ?? null, likes: s.user.likes_count ?? null, posts: s.user.video_count ?? null, views: s.views,
  }, { onConflict: "account_id,day" });
  if (error) throw error;
  // Chaque vidéo : ses chiffres du moment, et une ligne par jour (vues à 24 h et à 7 jours)
  const now = new Date().toISOString();
  const rows = s.videos.filter(v => v.id).map(v => ({
    account_id: accountId, external_id: v.id,
    title: (v.title || v.video_description || "").slice(0, 300) || null, url: v.share_url ?? null, cover_url: v.cover_image_url ?? null,
    duration: v.duration ?? null, published_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
    views: v.view_count ?? 0, likes: v.like_count ?? 0, comments: v.comment_count ?? 0, shares: v.share_count ?? 0, updated_at: now,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    const { error: e1 } = await admin.from("social_videos").upsert(part, { onConflict: "account_id,external_id" });
    // Migration 20261110000000_reseaux_videos.sql pas encore lancée : les chiffres du compte restent notés
    if (e1?.code === "PGRST205" || e1?.code === "42P01") { console.error("social_videos manquante :", e1.message); return; }
    if (e1) throw e1;
    const { error: e2 } = await admin.from("social_video_stats").upsert(
      part.map(r => ({ account_id: r.account_id, external_id: r.external_id, day: today(), views: r.views, likes: r.likes, comments: r.comments, shares: r.shares })),
      { onConflict: "account_id,external_id,day" });
    if (e2) throw e2;
  }
}

/** Retour de TikTok : échange le code, crée (ou retrouve) le compte, garde les jetons et note les chiffres du jour */
export async function tiktokConnect(admin: SupabaseClient, code: unknown, state: unknown): Promise<{ handle: string; kind: string } | { error: string }> {
  const st = readState(state);
  if (!st) return { error: "Ce lien a expiré. Demande-en un nouveau à Frigia." };
  if (typeof code !== "string" || !code) return { error: "TikTok n'a pas donné l'autorisation." };
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: `${st.origin}/admin` });
  const scopes = t.scope ?? "";
  const stats = await fetchStats(t.access_token, scopes);
  const handle = handleOf(stats.user);

  // Le même compte TikTok déjà lié (même open_id), sinon le même nom, sinon un nouveau compte
  const { data: linked } = await admin.from("social_tokens").select("account_id").eq("external_id", t.open_id).maybeSingle();
  let accountId = linked?.account_id as string | undefined;
  if (!accountId) {
    const { data: same } = await admin.from("social_accounts").select("id").eq("platform", "tiktok").eq("handle", handle).maybeSingle();
    accountId = same?.id as string | undefined;
  }
  if (!accountId) {
    const { data, error } = await admin.from("social_accounts")
      .insert({ platform: "tiktok", handle, kind: st.kind, name: st.kind === "createur" ? stats.user.display_name?.slice(0, 80) ?? null : null })
      .select("id").single();
    if (error) throw error;
    accountId = data.id as string;
  }
  const { error } = await admin.from("social_tokens").upsert({
    account_id: accountId, external_id: t.open_id, access_token: t.access_token, refresh_token: t.refresh_token ?? null,
    access_expires_at: expiresAt(t.expires_in), refresh_expires_at: expiresAt(t.refresh_expires_in), scopes,
    linked_at: new Date().toISOString(), last_sync_at: new Date().toISOString(), last_error: null,
  }, { onConflict: "account_id" });
  if (error) throw error;
  await saveStats(admin, accountId, stats);
  return { handle, kind: st.kind };
}

type Row = { account_id: string; access_token: string; refresh_token: string | null; access_expires_at: string; scopes: string | null };

/** Relève les chiffres des comptes liés (tous, ou un seul) : renvoie combien ont marché */
export async function tiktokSync(admin: SupabaseClient, accountId?: string): Promise<{ ok: number; failed: number }> {
  if (!tiktokReady()) return { ok: 0, failed: 0 };
  let q = admin.from("social_tokens").select("account_id, access_token, refresh_token, access_expires_at, scopes");
  if (accountId) q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) throw error;
  let ok = 0, failed = 0;
  for (const row of (data ?? []) as Row[]) {
    try {
      let token = row.access_token;
      // Le jeton d'accès dure 24 h : on le renouvelle avec le jeton de rafraîchissement (1 an)
      if (Date.parse(row.access_expires_at) < Date.now() + 10 * 60_000) {
        if (!row.refresh_token) throw new Error("Lien expiré : reconnecte le compte.");
        const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: row.refresh_token });
        token = t.access_token;
        await admin.from("social_tokens").update({
          access_token: t.access_token, refresh_token: t.refresh_token ?? row.refresh_token,
          access_expires_at: expiresAt(t.expires_in), ...(t.refresh_expires_in ? { refresh_expires_at: expiresAt(t.refresh_expires_in) } : {}),
        }).eq("account_id", row.account_id);
      }
      await saveStats(admin, row.account_id, await fetchStats(token, row.scopes ?? ""));
      await admin.from("social_tokens").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("account_id", row.account_id);
      ok++;
    } catch (e) {
      failed++;
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      console.error("tiktok sync:", row.account_id, message);
      await admin.from("social_tokens").update({ last_error: message }).eq("account_id", row.account_id);
    }
  }
  return { ok, failed };
}
