// Ton abonnement Plus : les offres (places fondateur), l'état de l'abonnement, résilier, changer d'avis,
// mettre en pause un mois (une fois par an, même si on reprend plus tôt) et reprendre.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { pauseEndEmail } from "./_email.js";
import { finances } from "./_finances.js";
import {
  adminClient, authUser, currentSubscription, errorMessage, founderSeatsLeft, hasCreatorOffer, periodEnd, planOf, plusOneMonth, preflight, stripeClient, type Req, type Res,
} from "./_shared.js";

const YEAR_S = 365 * 24 * 3600;


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

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long" });

/** « septembre » si la carte de l'abonnement a expiré (« septembre 2025 » si ce n'est pas cette année), sinon null. */
async function expiredCard(stripe: Stripe, sub: Stripe.Subscription): Promise<string | null> {
  let pm = sub.default_payment_method;
  if (!pm) {
    const customer = await stripe.customers.retrieve(typeof sub.customer === "string" ? sub.customer : sub.customer.id);
    pm = customer.deleted ? null : customer.invoice_settings.default_payment_method;
  }
  const card = (typeof pm === "string" ? await stripe.paymentMethods.retrieve(pm) : pm)?.card;
  if (!card) return null;
  const now = new Date();
  // Une carte reste valable jusqu'à la fin de son mois
  if (card.exp_year * 12 + card.exp_month >= now.getFullYear() * 12 + now.getMonth() + 1) return null;
  const month = MONTH.format(new Date(card.exp_year, card.exp_month - 1, 1));
  return card.exp_year === now.getFullYear() ? month : `${month} ${card.exp_year}`;
}

const HOUR_S = 3600;

/** Tous les jours (vercel.json, crons) : prévient la veille ceux dont la pause se termine.
 *  Fenêtre de 25 h pour ne rater personne si le cron glisse ; un email en double est évité par Resend. */
async function pauseReminders(admin: SupabaseClient): Promise<number> {
  const now = Date.now() / 1000;
  let sent = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      const until = u.app_metadata?.pause_until;
      if (u.email && typeof until === "number" && until >= now + 12 * HOUR_S && until < now + 37 * HOUR_S) {
        if (await pauseEndEmail(u.email, until, `pause-end-${u.id}-${until}`)) sent++;
      }
    }
    if (data.users.length < 1000) return sent;
  }
}

export default async function handler(req: Req, res: Res) {
  // Le cron de Vercel appelle en GET avec CRON_SECRET
  if (req.method === "GET" && process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`) {
    try { return res.json({ sent: await pauseReminders(adminClient()) }); } catch (e) {
      console.error("pause reminders:", errorMessage(e));
      return res.status(500).json({ error: "failed" });
    }
  }
  if (preflight(req, res)) return;
  const { action, reason } = (req.body ?? {}) as { action?: string; reason?: string };

  // Le dashboard de suivi (/admin) : l'argent encaissé (Stripe) et le coût de Claude, compte admin seulement
  if (action === "finances") {
    const caller = await authUser(req, adminClient());
    if (caller?.app_metadata?.admin !== true) return res.status(403).json({ error: "Réservé à l'admin" });
    const days = Number((req.body as { days?: unknown }).days) || 30;
    return res.json(await finances(process.env.STRIPE_SECRET_KEY ? stripeClient() : null, adminClient(), days));
  }

  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: "Stripe not configured" });
  const stripe = stripeClient();

  if (action === "offers") {
    // creatorOffer : un code créateur attend son premier abonnement (3 mois pour 13,98 €)
    const caller = await authUser(req, adminClient()).catch(() => null);
    // usedCode : le code déjà mis sur le compte (à l'inscription) : le paywall ne le redemande pas
    const creatorOffer = caller ? await hasCreatorOffer(adminClient(), caller).catch(() => false) : false;
    const { data: used } = caller ? await adminClient().from("code_uses").select("code").eq("user_id", caller.id).maybeSingle() : { data: null };
    const usedCode = (used?.code as string | undefined) ?? null;
    try { return res.json({ founderLeft: await founderSeatsLeft(stripe), creatorOffer, usedCode }); } catch { return res.json({ founderLeft: 0, creatorOffer, usedCode }); }
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
      // Tant que la date de paiement d'origine n'est pas passée, Stripe reste en « trialing » : Plus jusque-là
      const meta = { pause_from: null, pause_until: null, pause_renew: null, ...(typeof trialEnd === "number" ? { plus_until: Math.max(trialEnd, typeof m.plus_until === "number" ? m.plus_until : 0) } : {}) };
      await setMeta(admin, user, meta);
      return res.json({ subscription: describe(updated, { ...user, app_metadata: { ...user.app_metadata, ...meta } }) });
    }

    // Paiement refusé : on ne dit la raison que si la carte a expiré (le reste reste général, c'est moins gênant)
    if (action === "payfail") return res.json({ expired: await expiredCard(stripe, sub) });

    // Retour du portail Stripe avec une nouvelle carte : on retente tout de suite la facture en attente
    if (action === "retry") {
      if (["past_due", "unpaid"].includes(sub.status)) {
        const ref = sub.latest_invoice;
        const invoice = typeof ref === "string" ? await stripe.invoices.retrieve(ref) : ref;
        if (invoice?.id && invoice.status === "open") {
          try {
            await stripe.invoices.pay(invoice.id);
          } catch {
            return res.status(402).json({ error: "Ta banque n'a pas validé le paiement.", code: "declined" });
          }
        }
      }
      return res.json({ subscription: describe(await stripe.subscriptions.retrieve(sub.id), user) });
    }

    return res.json({ subscription: describe(sub, user) });
  } catch (e) {
    console.error("subscription:", errorMessage(e));
    return res.status(500).json({ error: "Ça n'a pas marché. Réessaie." });
  }
}
