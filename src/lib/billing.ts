// Abonnement Stripe : accès, page de paiement, portail client.
import type { User } from "./types";
import { postApi } from "./api";

const ACTIVE_STATUSES = ["active", "trialing", "incomplete"];

export function subscriptionStatus(u: User | null | undefined): string | undefined {
  return u?.app_metadata?.subscription_status;
}

/** Accès à l'appli : compte sur liste blanche ou abonnement actif / en essai. */
export function hasAccess(u: User | null | undefined): boolean {
  if (!u) return false;
  if (u.app_metadata?.is_whitelisted) return true;
  return ACTIVE_STATUSES.includes(subscriptionStatus(u) ?? "");
}

/** Demande une URL Stripe (paiement ou portail). Renvoie { url } ou { error }. */
async function stripeUrl(path: "/api/create-checkout" | "/api/customer-portal"): Promise<{ url?: string; error?: string }> {
  const res = await postApi(path);
  return res.json();
}

export const createCheckoutUrl = () => stripeUrl("/api/create-checkout");
export const customerPortalUrl = () => stripeUrl("/api/customer-portal");
