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
