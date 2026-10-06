import Stripe from "stripe";
import { createClient, type User } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = ["https://frigia.fr", "https://frigia-ten.vercel.app", "http://localhost:5173"];

// Only app_metadata is trusted (written by the Stripe webhook, not editable by the user).
// Older accounts may not have it yet, so fall back to the Stripe customer with the account email.
async function findCustomerId(stripe: Stripe, user: User): Promise<string | null> {
  if (user.app_metadata?.stripe_customer_id) return user.app_metadata.stripe_customer_id;
  if (!user.email) return null;
  const { data } = await stripe.customers.list({ email: user.email, limit: 1 });
  return data[0]?.id ?? null;
}

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
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const customerId = await findCustomerId(stripe, user);
    if (!customerId) return res.status(400).json({ error: "No Stripe customer found" });
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0],
    });
    res.json({ url: portalSession.url });
  } catch (err: any) {
    return res.status(500).json({ error: "Impossible d'ouvrir le portail de facturation. Réessayez." });
  }
}
