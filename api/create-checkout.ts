// Passer à Plus : ouvre la page de paiement Stripe pour la formule choisie (mensuel ou annuel).
// L'annuel est au prix fondateur (29,99 €/an) tant qu'il reste des places parmi les 500 premiers.
import { adminClient, authUser, currentSubscription, findCustomerId, founderSeatsLeft, preflight, siteOrigin, stripeClient, type Req, type Res } from "./_shared.js";

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const user = await authUser(req, adminClient());
  if (!user || !user.email) return res.status(401).json({ error: "Invalid token" });

  const { plan } = (req.body ?? {}) as { plan?: string };
  const { STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, STRIPE_PRICE_FOUNDER } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_MONTHLY || !STRIPE_PRICE_YEARLY) return res.status(500).json({ error: "Stripe not configured" });

  const stripe = stripeClient();
  const origin = siteOrigin(req);
  try {
    const customer = await findCustomerId(stripe, user);
    // Déjà un abonnement (paiement en retard…) : on ouvre le portail pour mettre la carte à jour.
    // Un premier paiement jamais abouti (« incomplete ») repasse par une nouvelle page de paiement.
    const sub = customer ? await currentSubscription(stripe, user) : null;
    if (customer && sub && sub.status !== "incomplete") {
      const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${origin}/plus/paiement?carte=1` });
      return res.json({ url: portal.url });
    }
    const price = plan === "month" ? STRIPE_PRICE_MONTHLY
      : STRIPE_PRICE_FOUNDER && await founderSeatsLeft(stripe) > 0 ? STRIPE_PRICE_FOUNDER : STRIPE_PRICE_YEARLY;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(customer ? { customer } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { supabase_user_id: user.id } },
      success_url: `${origin}/plus/paiement?checkout=success`,
      cancel_url: `${origin}/plus`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("create-checkout:", e);
    res.status(500).json({ error: "Impossible de créer la session de paiement. Réessayez." });
  }
}
