// Mettre à jour sa carte ou voir ses factures : ouvre le portail client Stripe.
import { adminClient, authUser, findCustomerId, preflight, siteOrigin, stripeClient, type Req, type Res } from "./_shared.js";

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const user = await authUser(req, adminClient());
  if (!user) return res.status(401).json({ error: "Invalid token" });

  try {
    const stripe = stripeClient();
    const customerId = await findCustomerId(stripe, user);
    if (!customerId) return res.status(400).json({ error: "No Stripe customer found" });
    const portalSession = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${siteOrigin(req)}/famille` });
    res.json({ url: portalSession.url });
  } catch {
    return res.status(500).json({ error: "Impossible d'ouvrir le portail de facturation. Réessayez." });
  }
}
