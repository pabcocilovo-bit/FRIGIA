// Ton abonnement Plus : les offres (places fondateur), l'état de l'abonnement, résilier, changer d'avis,
// mettre en pause un mois (une fois par an, même si on reprend plus tôt) et reprendre.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  adminClient, authUser, currentSubscription, errorMessage, founderSeatsLeft, periodEnd, planOf, preflight, stripeClient, type Req, type Res,
} from "./_shared.js";

const YEAR_S = 365 * 24 * 3600;

/** Même date le mois suivant (secondes). */
const plusOneMonth = (s: number) => { const d = new Date(s * 1000); d.setMonth(d.getMonth() + 1); return Math.floor(d.getTime() / 1000); };

async function setMeta(admin: SupabaseClient, user: User, meta: Record<string, unknown>) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: meta });
  if (error) throw error;
}

function describe(sub: Stripe.Subscription, user: User) {
  const m = user.app_metadata || {};
  const price = sub.items.data[0]?.price;
  const pauseUntil = typeof m.pause_until === "number" && m.pause_until * 1000 > Date.now() ? m.pause_until : null;
  return {
    plan: planOf(sub),
    amount: price?.unit_amount ?? null,
    interval: price?.recurring?.interval ?? "month",
    periodEnd: periodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    pauseFrom: pauseUntil ? m.pause_from : null,
    pauseUntil,
    canPause: !sub.cancel_at_period_end && !pauseUntil && !(typeof m.last_pause_at === "number" && Date.now() / 1000 - m.last_pause_at < YEAR_S),
  };
}

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const { action, reason } = (req.body ?? {}) as { action?: string; reason?: string };
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: "Stripe not configured" });
  const stripe = stripeClient();

  if (action === "offers") {
    try { return res.json({ founderLeft: await founderSeatsLeft(stripe) }); } catch { return res.json({ founderLeft: 0 }); }
  }

  const admin = adminClient();
  const user = await authUser(req, admin);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  try {
    const sub = await currentSubscription(stripe, user);
    if (!sub) return res.json({ subscription: null });

    if (action === "cancel") {
      const updated = await stripe.subscriptions.update(sub.id, {
        cancel_at_period_end: true,
        ...(reason ? { cancellation_details: { comment: reason.slice(0, 200) } } : {}),
      });
      return res.json({ subscription: describe(updated, user) });
    }

    if (action === "undo") {
      const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
      return res.json({ subscription: describe(updated, user) });
    }

    if (action === "pause") {
      if (!describe(sub, user).canPause) return res.status(409).json({ error: "La pause n'est possible qu'une fois par an." });
      // Mensuel : le paiement suivant est sauté, Plus se met en veille un mois à partir de cette date.
      // Annuel : Plus se met en veille un mois tout de suite, et l'année est prolongée d'autant.
      const now = Math.floor(Date.now() / 1000);
      const end = periodEnd(sub);
      const yearly = sub.items.data[0]?.price.recurring?.interval === "year";
      const from = yearly ? now : end;
      const until = plusOneMonth(from);
      const updated = await stripe.subscriptions.update(sub.id, { trial_end: plusOneMonth(end), proration_behavior: "none" });
      const meta = { pause_from: from, pause_until: until, pause_renew: end, last_pause_at: now };
      await setMeta(admin, user, meta);
      return res.json({ subscription: describe(updated, { ...user, app_metadata: { ...user.app_metadata, ...meta } }) });
    }

    if (action === "resume") {
      const m = user.app_metadata || {};
      if (typeof m.pause_until !== "number") return res.json({ subscription: describe(sub, user) });
      // On remet la date de paiement d'origine ; si elle est déjà passée, le paiement reprend tout de suite
      const now = Math.floor(Date.now() / 1000);
      const trialEnd = typeof m.pause_renew === "number" && m.pause_renew > now + 60 ? m.pause_renew : "now";
      const updated = await stripe.subscriptions.update(sub.id, { trial_end: trialEnd, proration_behavior: "none" });
      const meta = { pause_from: null, pause_until: null, pause_renew: null };
      await setMeta(admin, user, meta);
      return res.json({ subscription: describe(updated, { ...user, app_metadata: { ...user.app_metadata, ...meta } }) });
    }

    return res.json({ subscription: describe(sub, user) });
  } catch (e) {
    console.error("subscription:", errorMessage(e));
    return res.status(500).json({ error: "Ça n'a pas marché. Réessaie." });
  }
}
