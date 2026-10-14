// Ton abonnement Plus : l'état chez Stripe (gardé le temps de la visite) et les phrases qui le décrivent.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { subscriptionAction, type PlanChoice, type Subscription } from "../../lib/billing";

/** Pourquoi « Passe à Plus » s'ouvre : la phrase sous « Frigia Plus ». */
export const WHY = {
  def: "Fini le « on mange quoi ce soir ? », et moins de courses à la poubelle.",
  quota: "Tu as utilisé tes 15 scans gratuits. Avec Plus, scanne autant que tu veux.",
  planning: "Le planning de la semaine est dans Frigia Plus.",
  courses: "La liste de courses est dans Frigia Plus.",
  famille: "Le mode famille est dans Frigia Plus : les goûts de chacun, les portions calculées.",
  idees: "« D'autres idées » est dans Frigia Plus, sans utiliser de scan.",
  historique: "Tout ton historique est dans Frigia Plus.",
  favoris: "En gratuit, tes favoris des 7 derniers jours. Avec Plus, tu les gardes tous.",
  bilan: "Ton bilan d'économies complet est dans Frigia Plus.",
};
export type Why = keyof typeof WHY;
/** Ce que « Passe à Plus » reçoit : la raison, et l'écran à ouvrir une fois abonné. */
export type PaywallState = { why?: Why; go?: string; /** « Utiliser un code » des réglages : le champ code ouvert */ code?: boolean };

/** Ouvre « Passe à Plus » (formule Gratuit) avec sa raison, et l'écran à ouvrir une fois abonné. */
export function useOpenPaywall() {
  const navigate = useNavigate();
  return (why: Why, go?: string) => navigate("/plus", { state: { why, go } satisfies PaywallState });
}

// Le choix fait avant de partir sur la page Stripe : la formule, et l'écran à ouvrir au retour
const GO_KEY = "frigia_plus_go";
export function rememberCheckout(plan: PlanChoice, go: string | undefined) {
  try { sessionStorage.setItem(GO_KEY, JSON.stringify({ plan, go })); } catch { /* navigation privée */ }
}
export function checkoutChoice(): { plan: PlanChoice; go?: string } {
  try { return JSON.parse(sessionStorage.getItem(GO_KEY) || "null") ?? { plan: "year" }; } catch { return { plan: "year" }; }
}

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const DAY_YEAR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
/** « 6 novembre », ou « 6 octobre 2027 » quand ce n'est pas cette année (ou quand on veut l'année). */
export function longDate(s: number, withYear?: boolean): string {
  const d = new Date(s * 1000);
  return (withYear ?? d.getFullYear() !== new Date().getFullYear() ? DAY_YEAR : DAY).format(d);
}
const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";
export const isYearly = (sub: Subscription) => sub.interval === "year";

/** Le prix de l'abonnement : « 29,99 €/an, prix fondateur », « 6,99 €/mois ». */
export function priceText(sub: Subscription): string {
  const price = sub.amount != null ? `${euros(sub.amount)}/${isYearly(sub) ? "an" : "mois"}` : "Frigia Plus";
  return sub.plan === "founder" ? `${price}, prix fondateur` : price;
}

/** La ligne sous « Frigia Plus » dans Famille. */
export function subscriptionText(sub: Subscription): string {
  const end = longDate(sub.periodEnd);
  if (sub.cancelAtPeriodEnd) return `Se termine le ${end} · sans renouvellement`;
  if (sub.pauseUntil) return isYearly(sub) ? `En pause jusqu'au ${longDate(sub.pauseUntil)} · renouvelé le ${end}` : `En pause · prochain paiement le ${end}`;
  return isYearly(sub) ? `${priceText(sub)} · renouvelé le ${end}` : `${priceText(sub)} · prochain paiement le ${end}`;
}

let cache: { userId: string; sub: Subscription | null } | null = null;

/** L'abonnement Stripe du compte : undefined tant qu'on ne le connaît pas, null s'il n'y en a pas.
 *  failed : Stripe n'a pas répondu (on garde ce qu'on savait). */
export function useSubscription(userId: string | undefined, enabled = true) {
  const [sub, setSub] = useState<Subscription | null | undefined>(() => (cache && cache.userId === userId ? cache.sub : undefined));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true;
    subscriptionAction("status")
      .then(s => { cache = { userId, sub: s }; if (live) { setSub(s); setFailed(false); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [userId, enabled]);
  const update = (s: Subscription | null) => { if (userId) cache = { userId, sub: s }; setSub(s); };
  return { sub, failed, update };
}
