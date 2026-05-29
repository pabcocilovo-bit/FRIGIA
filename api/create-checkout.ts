import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
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
  const allowedOrigins = ["https://frigia-ten.vercel.app", "http://localhost:5173"];
  const requestOrigin = req.headers.origin as string | undefined;
  const origin = allowedOrigins.includes(requestOrigin ?? "") ? requestOrigin! : "https://frigia-ten.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    metadata: { supabase_user_id: user.id },
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 4, metadata: { supabase_user_id: user.id } },
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancel`,
  });

  res.json({ url: session.url });
}
