// Frigia Plus : qui l'a (les 7 jours d'essai compris), le paiement Stripe et l'abonnement.
// Pas de formule gratuite (Hugo, 23 octobre) : 7 jours d'essai à l'inscription, 7 de plus avec un code, puis Plus.
import type { User } from "./types";
import { postApi } from "./api";

export const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fin de l'essai offert à l'inscription (ms) */
const trialEnd = (u: User) => (u.created_at ? new Date(u.created_at).getTime() : 0) + TRIAL_DAYS * DAY_MS;

/** Frigia Plus. Même règle que le serveur (api/_shared.ts) : seul app_metadata compte, écrit par le webhook Stripe
 *  (et par api/code.ts pour la semaine d'essai d'un code). */
export function isPlus(u: User | null | undefined, now = Date.now()): boolean {
  if (!u) return false;
  const m = u.app_metadata || {};
  if (m.is_whitelisted) return true;
  // Pause d'un mois : Plus est en veille entre la fin de la période payée et la reprise
  if (m.pause_from && m.pause_until && now >= m.pause_from * 1000 && now < m.pause_until * 1000) return false;
  // Les 7 jours d'essai
  if (now < trialEnd(u)) return true;
  // Jours d'essai d'un code, mois offerts (parrainage), mois d'un code créateur : Plus jusqu'à cette date
  if (typeof m.plus_until === "number" && now < m.plus_until * 1000) return true;
  if (m.subscription_status === "active") return true;
  // Abonné pendant l'essai (période d'essai chez Stripe, plus_until la suit) ou en pause
  if (m.subscription_status === "trialing") return !!m.pause_until;
  return false;
}

/** En essai (pas encore abonné) : la fin des jours offerts (ms), sinon null. */
export function trialUntil(u: User | null | undefined, now = Date.now()): number | null {
  if (!u) return null;
  const m = u.app_metadata || {};
  if (m.is_whitelisted || ["active", "trialing", "past_due", "unpaid"].includes(m.subscription_status)) return null;
  const end = Math.max(trialEnd(u), typeof m.plus_until === "number" ? m.plus_until * 1000 : 0);
  return now < end ? end : null;
}

/** « Encore 5 jours d'essai », « Dernier jour d'essai » */
export function trialText(end: number, now = Date.now()): string {
  // (une marge d'une minute : un « maintenant » lu quelques secondes plus tôt ne compte pas un jour de plus)
  const days = Math.ceil((end - now - 60e3) / DAY_MS);
  return days <= 1 ? "Dernier jour d'essai" : `Encore ${days} jours d'essai`;
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
export const checkoutUrl = (plan: PlanChoice) => post<{ url?: string; plus?: boolean }>("/api/create-checkout", { plan });
export const customerPortalUrl = () => post<{ url?: string }>("/api/customer-portal");
/** Places restantes au prix fondateur (500 premiers abonnés annuels). */
/** founderLeft : places au prix fondateur ; creatorOffer : un code créateur donne 3 mois pour 13,98 € au premier abonnement mensuel ;
 *  usedCode : le code déjà mis sur le compte */
export const fetchOffers = () => post<{ founderLeft: number; creatorOffer?: boolean; usedCode?: string | null }>("/api/subscription", { action: "offers" });
export const subscriptionAction = (action: "status" | "cancel" | "undo" | "pause" | "resume" | "retry", reason?: string) =>
  post<{ subscription: Subscription | null }>("/api/subscription", { action, reason }).then(r => r.subscription);
/** Paiement refusé : le mois où la carte a expiré (« septembre »), ou null si la raison n'est pas une carte expirée. */
export const expiredCardMonth = () => post<{ expired?: string | null }>("/api/subscription", { action: "payfail" }).then(r => r.expired ?? null);
/** Paiement de l'abonnement refusé au renouvellement : Stripe va retenter, la carte est à changer. */
export const paymentFailed = (u: User | null | undefined) => ["past_due", "unpaid"].includes(u?.app_metadata?.subscription_status);
