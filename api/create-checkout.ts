import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = ["https://frigia.fr", "https://frigia-ten.vercel.app", "http://localhost:5173"];

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin as string | undefined;
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0]);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
  const token = authHeader.replace("Bearer ", "");

  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user || !user.email) return res.status(401).json({ error: "Invalid token" });

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const priceId = process.env.STRIPE_PRICE_ID!;
  if (!stripeKey || !priceId) return res.status(500).json({ error: "Stripe not configured" });

  const stripe = new Stripe(stripeKey);
  const successOrigin = ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0];

  // Reuse existing Stripe customer to avoid duplicates
  const existingCustomerId = user.app_metadata?.stripe_customer_id || user.user_metadata?.stripe_customer_id;

  try {
    const isReturningCustomer = !!existingCustomerId;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: user.email }),
      metadata: { supabase_user_id: user.id },
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(isReturningCustomer ? {} : { trial_period_days: 4 }),
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${successOrigin}/?checkout=success`,
      cancel_url: `${successOrigin}/?checkout=cancel`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    return res.status(500).json({ error: "Impossible de créer la session de paiement. Réessayez." });
  }
}
