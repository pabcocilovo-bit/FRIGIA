import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };

// Best-effort dedup within the same serverless instance
const processedEvents = new Set<string>();

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: any, res: any) {
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
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Writes to app_metadata (admin-only, not user-writable)
  const updateUser = async (userId: string, status: string, customerId?: string) => {
    const appData: any = { subscription_status: status };
    if (customerId) appData.stripe_customer_id = customerId;
    const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: appData });
    if (error) throw new Error(`Supabase updateUser failed: ${error.message}`);
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
    } catch {}
    return null;
  };

  const getUserIdFromInvoice = async (invoice: Stripe.Invoice): Promise<string | null> => {
    const inv = invoice as any;
    const subscriptionId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      return getUserIdFromSubscription(sub);
    }
    return null;
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
          if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            status = sub.status;
          }
          await updateUser(userId, status, session.customer as string);
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await getUserIdFromSubscription(sub);
        if (userId) await updateUser(userId, sub.status);
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
        const userId = await getUserIdFromInvoice(invoice);
        if (userId) await updateUser(userId, "past_due");
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await getUserIdFromInvoice(invoice);
        if (userId) await updateUser(userId, "active");
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    // Return 500 so Stripe retries the webhook
    console.error("Webhook handler error:", err.message);
    return res.status(500).json({ error: "Handler failed, will retry" });
  }
}
