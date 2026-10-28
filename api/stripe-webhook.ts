import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { cancelEmail, payFailedEmail, renewalEmail } from "./_email.js";
import { errorMessage, grantPlusMonth, periodEnd, type Req, type Res } from "./_shared.js";
import { notify } from "./_push.js";

export const config = { api: { bodyParser: false } };

// Best-effort dedup within the same serverless instance
const processedEvents = new Set<string>();

async function getRawBody(req: Req): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).end();

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const stripe = new Stripe(stripeKey);
  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${errorMessage(err)}` });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Writes to app_metadata (admin-only, not user-writable)
  const updateUser = async (userId: string, status: string, customerId?: string, plusUntil?: number) => {
    const appData: Record<string, string | number> = { subscription_status: status };
    if (customerId) appData.stripe_customer_id = customerId;
    // Mois offert d'un code créateur (période d'essai) : Plus jusqu'à sa fin
    if (plusUntil) appData.plus_until = plusUntil;
    const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: appData });
    // Ignore "user not found" errors — account may have been deleted already
    if (error && !error.message.includes("not found") && !error.message.includes("User not found")) {
      throw new Error(`Supabase updateUser failed: ${error.message}`);
    }
  };

  const getUserIdFromSubscription = async (sub: Stripe.Subscription): Promise<string | null> => {
    if (sub.metadata?.supabase_user_id) return sub.metadata.supabase_user_id;
    // Fallback: look up by customer email via Stripe
    try {
      const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
      if (customer.email) {
        const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const found = data?.users?.find(u => u.email === customer.email);
        if (found) return found.id;
      }
    } catch { /* client introuvable : on ne peut pas relier le compte */ }
    return null;
  };

  const subscriptionOfInvoice = async (invoice: Stripe.Invoice): Promise<Stripe.Subscription | null> => {
    // Ancienne API : invoice.subscription ; depuis 2025 : invoice.parent.subscription_details.subscription
    const inv = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
    const ref = inv.subscription ?? invoice.parent?.subscription_details?.subscription;
    const subscriptionId = typeof ref === "string" ? ref : ref?.id;
    return subscriptionId ? stripe.subscriptions.retrieve(subscriptionId) : null;
  };

  const getUserIdFromInvoice = async (invoice: Stripe.Invoice): Promise<string | null> => {
    const sub = await subscriptionOfInvoice(invoice);
    return sub ? getUserIdFromSubscription(sub) : null;
  };

  // Premier vrai paiement de Plus : compté pour le code utilisé, et l'ami qui a invité gagne un mois (une seule fois)
  const firstPayment = async (userId: string) => {
    const now = new Date().toISOString();
    const { error } = await admin.from("code_uses").update({ subscribed_at: now }).eq("user_id", userId).is("subscribed_at", null);
    if (error) return; // pas de table des codes (migration 20261020000000 pas lancée)
    const { data } = await admin.from("code_uses").update({ rewarded_at: now })
      .eq("user_id", userId).eq("kind", "friend").is("rewarded_at", null).not("referrer", "is", null).select("referrer");
    const referrer = data?.[0]?.referrer as string | undefined;
    if (!referrer) return;
    try {
      await grantPlusMonth(admin, stripe, referrer);
    } catch (e) {
      // On rend la récompense pour que Stripe, en réessayant, la redonne
      await admin.from("code_uses").update({ rewarded_at: null }).eq("user_id", userId);
      throw e;
    }
    const { data: p } = await admin.from("profiles").select("first_name").eq("id", userId).maybeSingle();
    const name = ((p?.first_name as string | null) ?? "").trim().split(/\s+/)[0] || "Ton ami";
    await notify(admin, referrer, {
      kind: "referral", key: `ref-plus:${userId}`, url: "/parrainage",
      title: `${name} a pris Frigia Plus : un mois offert pour toi`,
      body: "Ton mois de Plus est ajouté. Merci de faire connaître Frigia.",
    });
  };

  /** L'adresse du compte, sinon celle du client Stripe. */
  const emailOf = async (userId: string | null, sub: Stripe.Subscription): Promise<string | null> => {
    if (userId) {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data?.user?.email) return data.user.email;
    }
    try {
      const customer = await stripe.customers.retrieve(sub.customer as string);
      return customer.deleted ? null : customer.email;
    } catch { return null; }
  };

  if (processedEvents.has(event.id)) return res.json({ received: true });
  processedEvents.add(event.id);
  if (processedEvents.size > 500) {
    const first = processedEvents.values().next().value;
    if (first) processedEvents.delete(first);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.supabase_user_id;
        if (userId) {
          // Read actual subscription status instead of hardcoding "trialing"
          let status = "trialing";
          let trialEnd: number | undefined;
          if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            status = sub.status;
            if (sub.status === "trialing" && sub.trial_end) trialEnd = sub.trial_end;
          }
          await updateUser(userId, status, session.customer as string, trialEnd);
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await getUserIdFromSubscription(sub);
        if (userId) await updateUser(userId, sub.status);
        // Résiliation (depuis l'appli ou le portail Stripe) : l'email de confirmation part d'ici
        const before = event.data.previous_attributes as Partial<Stripe.Subscription> | undefined;
        const nowCanceling = sub.cancel_at_period_end || !!sub.cancel_at;
        const wasCanceling = before && ("cancel_at_period_end" in before || "cancel_at" in before)
          ? !!before.cancel_at_period_end || !!before.cancel_at
          : nowCanceling;
        if (nowCanceling && !wasCanceling) {
          const email = await emailOf(userId, sub);
          if (email) await cancelEmail(email, sub.cancel_at ?? periodEnd(sub), `cancel-${event.id}`);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await getUserIdFromSubscription(sub);
        if (userId) await updateUser(userId, "canceled");
        break;
      }
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await getUserIdFromSubscription(sub);
        if (userId) await updateUser(userId, "paused");
        break;
      }
      case "customer.subscription.resumed": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await getUserIdFromSubscription(sub);
        if (userId) await updateUser(userId, "active");
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await subscriptionOfInvoice(invoice);
        const userId = sub ? await getUserIdFromSubscription(sub) : null;
        if (userId) await updateUser(userId, "past_due");
        // Renouvellement refusé : un email au premier échec (au premier paiement, l'abonné est encore sur la page)
        if (sub && invoice.billing_reason === "subscription_cycle" && invoice.attempt_count === 1) {
          const email = await emailOf(userId, sub);
          if (email) await payFailedEmail(email, invoice.amount_due, `payfail-${invoice.id}`);
        }
        break;
      }
      case "invoice.upcoming": {
        // Reconduction d'un abonnement annuel : prévenir avant (art. L215-1 du Code de la consommation).
        // Stripe l'envoie le nombre de jours réglé dans Billing > Subscriptions (« Upcoming renewal events »).
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await subscriptionOfInvoice(invoice);
        if (!sub || sub.cancel_at_period_end || sub.cancel_at || sub.items.data[0]?.price.recurring?.interval !== "year") break;
        const email = await emailOf(await getUserIdFromSubscription(sub), sub);
        const renewsAt = periodEnd(sub);
        if (email) await renewalEmail(email, renewsAt, invoice.amount_due, `renew-${sub.id}-${renewsAt}`);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await getUserIdFromInvoice(invoice);
        if (userId) await updateUser(userId, "active");
        if (userId && invoice.amount_paid > 0) await firstPayment(userId);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    // Return 500 so Stripe retries the webhook
    console.error("Webhook handler error:", errorMessage(err));
    return res.status(500).json({ error: "Handler failed, will retry" });
  }
}
