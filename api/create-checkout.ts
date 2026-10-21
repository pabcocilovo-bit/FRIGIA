// Passer à Plus : ouvre la page de paiement Stripe pour la formule choisie (mensuel ou annuel).
// L'annuel est au prix fondateur (29,99 €/an) tant qu'il reste des places parmi les 500 premiers.
import {
  adminClient, authUser, CREATOR_OFFER, currentSubscription, findCustomerId, founderSeatsLeft, hasCreatorOffer, isPlus, plusOneMonth, preflight, siteOrigin, stripeClient, type Req, type Res,
} from "./_shared.js";

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
    // Abonnement déjà payé que le compte ne voyait pas (webhook manqué) : on recopie l'état de Stripe
    // sur le compte au lieu d'ouvrir le portail, et l'appli affiche Plus.
    if (customer && sub && ["active", "trialing"].includes(sub.status)) {
      const m = user.app_metadata || {};
      const meta: Record<string, string | number> = { subscription_status: sub.status, stripe_customer_id: customer };
      if (sub.status === "trialing" && sub.trial_end) meta.plus_until = Math.max(sub.trial_end, typeof m.plus_until === "number" ? m.plus_until : 0);
      const { data, error } = await adminClient().auth.admin.updateUserById(user.id, { app_metadata: meta });
      if (error) throw error;
      if (isPlus(data.user)) return res.json({ plus: true });
    }
    if (customer && sub && sub.status !== "incomplete") {
      const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${origin}/plus/paiement?carte=1` });
      return res.json({ url: portal.url });
    }
    // Code créateur, mensuel, premier abonnement : 3 mois payés d'avance (13,98 €), puis 6,99 €/mois.
    // Les 3 mois sont une période d'essai chez Stripe, payée d'un coup par une ligne unique sur la première facture.
    const offer = plan === "month" && !customer && await hasCreatorOffer(adminClient(), user);
    let trialEnd = Math.floor(Date.now() / 1000);
    for (let i = 0; i < CREATOR_OFFER.months; i++) trialEnd = plusOneMonth(trialEnd);
    const price = plan === "month" ? STRIPE_PRICE_MONTHLY
      : STRIPE_PRICE_FOUNDER && await founderSeatsLeft(stripe) > 0 ? STRIPE_PRICE_FOUNDER : STRIPE_PRICE_YEARLY;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(customer ? { customer } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      line_items: [{ price, quantity: 1 }, ...(offer ? [{
        price_data: { currency: "eur", unit_amount: CREATOR_OFFER.cents, product_data: { name: `Frigia Plus, ${CREATOR_OFFER.months} mois payés d'avance (code créateur)` } },
        quantity: 1,
      }] : [])],
      subscription_data: { metadata: { supabase_user_id: user.id }, ...(offer ? { trial_end: trialEnd } : {}) },
      success_url: `${origin}/plus/paiement?checkout=success`,
      cancel_url: `${origin}/plus`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("create-checkout:", e);
    res.status(500).json({ error: "Impossible de créer la session de paiement. Réessayez." });
  }
}
