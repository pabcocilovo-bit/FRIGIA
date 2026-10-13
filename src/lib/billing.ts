// Formules Gratuit et Plus : qui a Plus, les scans gratuits qui restent, le paiement Stripe et l'abonnement.
import type { User } from "./types";
import { postApi } from "./api";
import { supabase } from "../supabase";

const TRIAL_MS = 4 * 24 * 60 * 60 * 1000;

/** Frigia Plus. Même règle que le serveur (api/_shared.ts) : seul app_metadata compte, écrit par le webhook Stripe. */
export function isPlus(u: User | null | undefined, now = Date.now()): boolean {
  if (!u) return false;
  const m = u.app_metadata || {};
  if (m.is_whitelisted) return true;
  // Pause d'un mois : Plus est en veille entre la fin de la période payée et la reprise
  if (m.pause_from && m.pause_until && now >= m.pause_from * 1000 && now < m.pause_until * 1000) return false;
  if (m.subscription_status === "active") return true;
  if (m.subscription_status === "trialing") return !!m.pause_until || now < new Date(u.created_at).getTime() + TRIAL_MS;
  return false;
}

// ─── Scans gratuits ──────────────────────────────────────────────────────────

export const FREE_SCANS = 15;
export type ScanQuota = { used: number; bonus: number };

const quotaKey = (userId: string) => `frigia_quota_${userId}`;
export function getCachedQuota(userId: string): ScanQuota | null {
  try { return JSON.parse(localStorage.getItem(quotaKey(userId)) || "null"); } catch { return null; }
}
export const setCachedQuota = (userId: string, q: ScanQuota) => localStorage.setItem(quotaKey(userId), JSON.stringify(q));

/** Scans gratuits utilisés et bonus (codes), comptés par le serveur dans profiles. */
export async function fetchScanQuota(userId: string): Promise<ScanQuota | null> {
  const { data, error } = await supabase.from("profiles").select("scans_used, bonus_scans").eq("id", userId).maybeSingle();
  if (error) return getCachedQuota(userId);
  const q = { used: data?.scans_used ?? 0, bonus: data?.bonus_scans ?? 0 };
  setCachedQuota(userId, q);
  return q;
}

export const quotaTotal = (q: ScanQuota | null) => FREE_SCANS + (q?.bonus ?? 0);
export const scansLeft = (q: ScanQuota | null) => Math.max(0, quotaTotal(q) - (q?.used ?? 0));

/** « 2 scans gratuits restants sur 15 » */
export function quotaText(q: ScanQuota | null): string {
  const left = scansLeft(q), total = quotaTotal(q);
  if (!left) return `Tes ${total} scans gratuits sont utilisés`;
  const s = left > 1 ? "s" : "";
  return `${left} scan${s} gratuit${s} restant${s} sur ${total}`;
}

// ─── Stripe ──────────────────────────────────────────────────────────────────

export type PlanChoice = "month" | "year";

export type Subscription = {
  plan: "month" | "year" | "founder" | null;
  amount: number | null;          // centimes
  interval: string;               // month ou year
  periodEnd: number;              // secondes
  cancelAtPeriodEnd: boolean;
  pauseFrom: number | null;
  pauseUntil: number | null;
  canPause: boolean;
};

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await postApi(path, body);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || "Ça n'a pas marché. Réessaie.");
  return json as T;
}

/** Ouvre la page de paiement Stripe (ou le portail si un abonnement existe déjà). */
export const checkoutUrl = (plan: PlanChoice) => post<{ url?: string }>("/api/create-checkout", { plan });
export const customerPortalUrl = () => post<{ url?: string }>("/api/customer-portal");
/** Places restantes au prix fondateur (500 premiers abonnés annuels). */
export const fetchOffers = () => post<{ founderLeft: number }>("/api/subscription", { action: "offers" });
export const subscriptionAction = (action: "status" | "cancel" | "undo" | "pause" | "resume" | "retry", reason?: string) =>
  post<{ subscription: Subscription | null }>("/api/subscription", { action, reason }).then(r => r.subscription);
/** Paiement refusé : le mois où la carte a expiré (« septembre »), ou null si la raison n'est pas une carte expirée. */
export const expiredCardMonth = () => post<{ expired?: string | null }>("/api/subscription", { action: "payfail" }).then(r => r.expired ?? null);
/** Paiement de l'abonnement refusé au renouvellement : Stripe va retenter, la carte est à changer. */
export const paymentFailed = (u: User | null | undefined) => ["past_due", "unpaid"].includes(u?.app_metadata?.subscription_status);
