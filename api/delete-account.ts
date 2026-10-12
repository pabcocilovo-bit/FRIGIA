import type { User } from "@supabase/supabase-js";
import Stripe from "stripe";
import { adminClient, authUser, errorMessage, preflight, type Req, type Res } from "./_shared.js";

// The webhook stores the customer id in app_metadata. Older accounts may not have it,
// so also include every Stripe customer created with the account email.
async function findCustomerIds(stripe: Stripe, user: User): Promise<string[]> {
  const ids = new Set<string>();
  if (user.app_metadata?.stripe_customer_id) ids.add(user.app_metadata.stripe_customer_id);
  if (user.email) {
    const { data } = await stripe.customers.list({ email: user.email, limit: 10 });
    data.forEach(c => ids.add(c.id));
  }
  return [...ids];
}

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }
  const admin = adminClient();
  const user = await authUser(req, admin);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  try {
    // Cancel billing first: if this fails, the account is kept so the user can retry
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe not configured");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    for (const customerId of await findCustomerIds(stripe, user)) {
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      await Promise.all(
        subscriptions.data
          .filter(s => s.status !== "canceled" && s.status !== "incomplete_expired")
          .map(s => stripe.subscriptions.cancel(s.id))
      );
    }
    await admin.from("user_history").delete().eq("user_id", user.id);
    await admin.from("user_favorites").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("id", user.id);
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: errorMessage(err) || "Échec de la suppression" });
  }
}
