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
