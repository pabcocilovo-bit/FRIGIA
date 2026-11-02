// Le dashboard de suivi (/admin) : les chiffres viennent d'une seule fonction Supabase,
// public.admin_dashboard (migration 20261105000000). Réservée aux comptes avec app_metadata.admin.
import { supabase } from "../../supabase";
import { postApi } from "../../lib/api";

export type Day = { jour: string; inscriptions: number; scans: number; cuisines: number; liste_attente: number };
export type SupportMsg = { id: number; kind: "bug" | "contact" | "idea"; topic: string | null; message: string; email: string | null; created_at: string };
export type Recreated = { email: string; created_at: string; status: string | null };
export type SharedLogin = { ip: string; user_agent: string | null; comptes: number; abonnes: number; emails: string; dernier: string };

export type Dashboard = {
  jours: number;
  genere_le: string;
  comptes: {
    total: number; nouveaux_7j: number; nouveaux_jour: number; connectes_7j: number;
    essai: number; abonnes: number; abonnes_essai: number; paiement_refuse: number; offerts: number;
    essai_fini_sans_payer: number; recrees_sans_essai: number;
  };
  actifs_7j: number;
  usage: {
    scans: number; scans_7j: number; cuisines: number; cuisines_7j: number; kg_sauves: number; eur_sauves: number;
    favoris: number; avis_beta: number; notifs_actives: number;
  };
  liste_attente: { total: number; invites: number; nouveaux_7j: number };
  par_jour: Day[];
  support_7j: { bug: number; contact: number; idea: number };
  support: SupportMsg[];
  abus: { recrees: Recreated[]; connexions: SharedLogin[] };
};

export type Loaded = { status: "ok"; data: Dashboard } | { status: "denied" } | { status: "error"; message: string };

export async function loadDashboard(days: number): Promise<Loaded> {
  const { data, error } = await supabase.rpc("admin_dashboard", { p_days: days });
  if (error) {
    if (error.message.includes("admin_seulement")) return { status: "denied" };
    // La migration n'est pas encore lancée sur cette base
    if (error.code === "PGRST202") return { status: "error", message: "La fonction admin_dashboard n'existe pas encore : lance la migration 20261105000000_dashboard_admin.sql dans Supabase." };
    return { status: "error", message: error.message };
  }
  return { status: "ok", data: data as Dashboard };
}

export const isAdmin = (user: { app_metadata?: Record<string, unknown> } | null | undefined) => user?.app_metadata?.admin === true;

// ─── L'argent : Stripe (encaissé) et Claude (coût), par api/subscription.ts (action « finances ») ───

export type Finances = {
  days: number;
  /** Clé Stripe de test : les paiements sont fictifs (le bandeau part tout seul avec la vraie clé) */
  stripeTest: boolean;
  /** Début des chiffres (YYYY-MM-DD) : rien avant le 29 octobre 2026 */
  from: string;
  stripe: {
    gross: number; refunds: number; fees: number; net: number; payments: number; mrr: number;
    active: { month: number; year: number; founder: number };
    byDay: { day: string; eur: number }[];
  } | null;
  claude: {
    usd: number; eur: number | null; byDay: { day: string; usd: number }[];
    /** Sans clé admin Anthropic : calculé d'après les tokens notés à chaque appel, depuis cette date */
    estimated?: { since: string | null; calls: number };
  } | null;
  missing: string[];
};

export async function loadFinances(days: number): Promise<Finances | null> {
  try {
    const r = await postApi("/api/subscription", { action: "finances", days });
    return r.ok ? await r.json() as Finances : null;
  } catch { return null; }
}

// ─── Les listes derrière les chiffres (public.admin_liste, migration 20261107000000) ───

export type ListKey = "comptes" | "nouveaux_7j" | "abonnes" | "essai" | "essai_fini" | "refuse" | "offerts" | "recrees"
  | "connectes_7j" | "actifs_7j" | "scans_7j" | "liste_attente";

export type Person = {
  email: string; prenom: string | null; created_at: string; last_sign_in_at: string | null;
  etat: "offert" | "abonne" | "abonne_essai" | "refuse" | "essai" | "fini"; plus_until: string | null;
  scans: number; scans_7j: number; cuisines: number; derniere_activite: string | null; recree: boolean;
};
export type WaitlistRow = { email: string; prenom: string | null; created_at: string; invite_le: string | null; source: string | null; a_un_compte: boolean };

export async function loadList(key: ListKey): Promise<{ ok: true; rows: (Person | WaitlistRow)[] } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("admin_liste", { p_liste: key });
  if (error) {
    if (error.code === "PGRST202") return { ok: false, message: "Lance la migration 20261107000000_dashboard_listes.sql dans Supabase pour voir les listes." };
    return { ok: false, message: error.message };
  }
  return { ok: true, rows: (data ?? []) as (Person | WaitlistRow)[] };
}

// ─── Réseaux : comptes Instagram, TikTok, YouTube et leurs chiffres (migration 20261108000000_reseaux.sql) ───

export type Platform = "instagram" | "tiktok" | "youtube" | "autre";
export type SocialStat = {
  day: string; followers: number | null; views: number | null; views_30d: number | null;
  likes: number | null; posts: number | null; source: "capture" | "manuel" | "api";
};
export type SocialAccount = {
  id: string; platform: Platform; handle: string; name: string | null; kind: "frigia" | "createur";
  code: string | null; cost_eur: number; created_at: string;
  /** Inscriptions et premiers abonnements avec son code créateur */
  inscrits: number; abonnes: number;
  /** 180 derniers jours, du plus ancien au plus récent */
  stats: SocialStat[];
  /** Compte lié (TikTok) : quand, dernier relevé automatique, dernière erreur ; null s'il ne l'est pas */
  lie?: { le: string; synchro: string | null; erreur: string | null } | null;
};
export type Social = { comptes: SocialAccount[]; codes: { code: string; creator: string | null }[] };
export type CaptureRead = { platform: Platform | null; handle: string | null; followers: number | null; views: number | null; views_30d: number | null; likes: number | null; posts: number | null };

export async function loadSocial(): Promise<{ ok: true; data: Social } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("admin_reseaux");
  if (error) {
    if (error.code === "PGRST202") return { ok: false, message: "Lance la migration 20261108000000_reseaux.sql dans Supabase pour voir les réseaux." };
    return { ok: false, message: error.message };
  }
  const d = data as Social;
  // numeric arrive en texte
  return { ok: true, data: { ...d, comptes: d.comptes.map(c => ({ ...c, cost_eur: Number(c.cost_eur) || 0 })) } };
}

/** Claude lit 1 à 3 captures d'écran du même compte (api/subscription.ts, action « social_capture ») */
export async function readCapture(images: { base64: string; type: string }[]): Promise<CaptureRead | string> {
  try {
    const r = await postApi("/api/subscription", { action: "social_capture", images: images.map(i => ({ data: i.base64, type: i.type })) });
    const body = await r.json().catch(() => ({})) as CaptureRead & { error?: string };
    return r.ok ? body : body.error || "La capture n'a pas pu être lue.";
  } catch { return "Pas de connexion. Réessaie."; }
}

export type AccountInput = Pick<SocialAccount, "platform" | "handle" | "name" | "kind" | "code" | "cost_eur">;

/** Crée le compte (ou reprend celui qui a déjà ce réseau et ce nom) : renvoie son id */
export async function saveAccount(a: AccountInput, id?: string): Promise<{ id: string } | { error: string }> {
  const row = { ...a, handle: a.handle.trim().replace(/^@/, ""), code: a.code?.trim().toUpperCase() || null, name: a.name?.trim() || null };
  const q = id
    ? supabase.from("social_accounts").update(row).eq("id", id).select("id").single()
    : supabase.from("social_accounts").upsert(row, { onConflict: "platform,handle" }).select("id").single();
  const { data, error } = await q;
  if (error) return { error: error.code === "23505" ? "Ce compte existe déjà." : error.code === "23514" ? "Vérifie le nom du compte et le code (lettres, chiffres, tirets)." : error.message };
  return { id: data.id as string };
}

/** Les chiffres d'un jour : remplace ceux déjà notés ce jour-là */
export async function saveStat(accountId: string, s: Omit<SocialStat, "source"> & { source: SocialStat["source"] }): Promise<string | null> {
  const { error } = await supabase.from("social_stats").upsert({ account_id: accountId, ...s, updated_at: new Date().toISOString() }, { onConflict: "account_id,day" });
  return error ? error.message : null;
}

export async function deleteAccount(id: string): Promise<string | null> {
  const { error } = await supabase.from("social_accounts").delete().eq("id", id);
  return error ? error.message : null;
}

export async function deleteStat(accountId: string, day: string): Promise<string | null> {
  const { error } = await supabase.from("social_stats").delete().eq("account_id", accountId).eq("day", day);
  return error ? error.message : null;
}

// ─── Comptes liés (TikTok) : api/_tiktok.ts, par api/subscription.ts ───

/** L'adresse d'autorisation TikTok : pour le compte de Frigia (à ouvrir tout de suite) ou à envoyer à un créateur (7 jours) */
export async function socialLink(kind: "frigia" | "createur"): Promise<{ url: string } | { error: string }> {
  try {
    const r = await postApi("/api/subscription", { action: "social_link", kind, origin: location.origin });
    const body = await r.json().catch(() => ({})) as { url?: string; error?: string };
    return body.url ? { url: body.url } : { error: body.error || "Le lien n'a pas pu être créé." };
  } catch { return { error: "Pas de connexion. Réessaie." }; }
}

/** Relève tout de suite les chiffres d'un compte lié (ou de tous) */
export async function socialSync(accountId?: string): Promise<string | null> {
  try {
    const r = await postApi("/api/subscription", { action: "social_sync", accountId });
    const body = await r.json().catch(() => ({})) as { failed?: number; error?: string };
    return !r.ok ? body.error || "Le relevé n'a pas marché." : body.failed ? "TikTok a refusé : regarde l'erreur sur le compte." : null;
  } catch { return "Pas de connexion. Réessaie."; }
}

/** Retour de TikTok sur /admin?code=…&state=… : sans compte Frigia (un créateur n'est pas admin) */
export async function socialConnect(code: string, state: string): Promise<{ handle: string; kind: string } | { error: string }> {
  try {
    const r = await fetch("/api/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "social_connect", code, state }) });
    const body = await r.json().catch(() => ({})) as { handle?: string; kind?: string; error?: string };
    return body.handle ? { handle: body.handle, kind: body.kind ?? "frigia" } : { error: body.error || "La liaison n'a pas marché." };
  } catch { return { error: "Pas de connexion. Réessaie." }; }
}

// ─── Vidéos des comptes liés (migration 20261110000000_reseaux_videos.sql) ───

export type Video = {
  account_id: string; id: string; title: string | null; url: string | null; cover_url: string | null;
  duration: number | null; published_at: string | null;
  views: number; likes: number; comments: number; shares: number;
  /** Vues au relevé du lendemain et à celui de J+7 (null : vidéo publiée avant la liaison, ou trop récente) */
  views_24h: number | null; views_7j: number | null;
};

/** [] si la migration n'est pas lancée : le reste de l'onglet marche sans */
export async function loadVideos(): Promise<Video[]> {
  const { data, error } = await supabase.rpc("admin_videos");
  return error ? [] : (data ?? []) as Video[];
}

/** (j'aime + commentaires + partages) / vues */
export const engagement = (v: Pick<Video, "views" | "likes" | "comments" | "shares">) => (v.views > 0 ? (v.likes + v.comments + v.shares) / v.views : null);
/** partages / vues : le meilleur signe qu'une vidéo peut partir */
export const shareRate = (v: Pick<Video, "views" | "shares">) => (v.views > 0 ? v.shares / v.views : null);
/** L'engagement de plusieurs vidéos ensemble (pondéré par les vues) */
export function engagementOf(list: Video[]): number | null {
  const views = list.reduce((t, v) => t + v.views, 0);
  return views > 0 ? list.reduce((t, v) => t + v.likes + v.comments + v.shares, 0) / views : null;
}
