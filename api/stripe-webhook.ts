import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };

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

  const updateUser = async (userId: string, status: string, customerId?: string) => {
    const data: any = { subscription_status: status };
    if (customerId) data.stripe_customer_id = customerId;
    await admin.auth.admin.updateUserById(userId, { user_metadata: data });
  };

  const getUserIdByCustomer = async (customerId: string): Promise<string | null> => {
    let page = 1;
    while (true) {
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000, page });
      if (!data?.users?.length) break;
      const found = data.users.find(u => u.user_metadata?.stripe_customer_id === customerId);
      if (found) return found.id;
      if (data.users.length < 1000) break;
      page++;
    }
    return null;
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.supabase_user_id;
      if (userId) {
        await updateUser(userId, "trialing", session.customer as string);
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await getUserIdByCustomer(sub.customer as string);
      if (userId) await updateUser(userId, sub.status);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await getUserIdByCustomer(sub.customer as string);
      if (userId) await updateUser(userId, "canceled");
      break;
    }
  }

  res.json({ received: true });
}
