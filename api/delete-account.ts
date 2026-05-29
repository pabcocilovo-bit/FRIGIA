import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const customerId = user.user_metadata?.stripe_customer_id;
    if (customerId && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
      await Promise.all(
        subscriptions.data
          .filter(s => s.status === "active" || s.status === "trialing")
          .map(s => stripe.subscriptions.cancel(s.id))
      );
    }
    await admin.from("user_history").delete().eq("user_id", user.id);
    await admin.from("user_favorites").delete().eq("user_id", user.id);
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Échec de la suppression" });
  }
}
