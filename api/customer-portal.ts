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
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  const customerId = user.user_metadata?.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: "No Stripe customer found" });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const origin = req.headers.origin || "https://frigia-ten.vercel.app";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: origin,
  });

  res.json({ url: portalSession.url });
}
