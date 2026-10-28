// Outils communs aux fonctions /api (le « _ » au début : Vercel n'en fait pas une route).
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
import Stripe from "stripe";

export type Req = IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> };
export type Res = ServerResponse & { status: (code: number) => Res; json: (body: unknown) => void };

const ALLOWED_ORIGINS = ["https://frigia.fr", "https://www.frigia.fr", "https://frigia-ten.vercel.app", "http://localhost:5173"];
// Aperçus Vercel des branches (ex. frigia-git-nouveau-design-app-pablo-s-projects16.vercel.app)
const PREVIEW_ORIGIN = /^https:\/\/frigia-[a-z0-9-]+-pablo-s-projects16\.vercel\.app$/;

/** L'adresse du site qui appelle, si on la connaît (sinon le site principal). */
export function siteOrigin(req: Req): string {
  const origin = req.headers.origin;
  return origin && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin)) ? origin : ALLOWED_ORIGINS[0];
}

/** En-têtes CORS. Renvoie true si la requête est déjà traitée (OPTIONS ou méthode refusée). */
export function preflight(req: Req, res: Res, methods = "POST"): boolean {
  res.setHeader("Access-Control-Allow-Origin", siteOrigin(req));
  res.setHeader("Access-Control-Allow-Methods", `${methods}, OPTIONS`);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return true; }
  if (!methods.split(", ").includes(req.method ?? "")) { res.status(405).json({ error: "Method not allowed" }); return true; }
  return false;
}

export const adminClient = (): SupabaseClient => createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Le compte qui appelle (jeton Supabase dans Authorization), ou null. */
export async function authUser(req: Req, admin: SupabaseClient): Promise<User | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await admin.auth.getUser(header.slice(7));
  return error ? null : user;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─── Frigia Plus ─────────────────────────────────────────────────────────────
// Même règle que src/lib/billing.ts (isPlus). Seul app_metadata compte : il est écrit par le webhook Stripe
// (et par api/code.ts pour les jours d'essai d'un code), le compte ne peut pas le modifier.
// Pas de formule gratuite (Hugo, 23 octobre) : 7 jours d'essai à l'inscription, 7 de plus avec un code, puis Plus.

export const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fin de l'essai offert à l'inscription (ms) */
export const trialEnd = (user: User) => (user.created_at ? new Date(user.created_at).getTime() : 0) + TRIAL_DAYS * DAY_MS;

export function isPlus(user: User, now = Date.now()): boolean {
  const m = user.app_metadata || {};
  if (m.is_whitelisted) return true;
  // Pause d'un mois : Plus est en veille entre la fin de la période payée et la reprise
  if (m.pause_from && m.pause_until && now >= m.pause_from * 1000 && now < m.pause_until * 1000) return false;
  // Les 7 jours d'essai
  if (now < trialEnd(user)) return true;
  // Jours d'essai d'un code, mois offerts (parrainage), mois d'un code créateur : Plus jusqu'à cette date
  if (typeof m.plus_until === "number" && now < m.plus_until * 1000) return true;
  if (m.subscription_status === "active") return true;
  // Abonné pendant l'essai (période d'essai chez Stripe, plus_until la suit) ou en pause
  if (m.subscription_status === "trialing") return !!m.pause_until;
  return false;
}

/** Une semaine d'essai de plus (un code) : à la suite de l'essai, des jours déjà offerts, ou d'aujourd'hui (secondes) */
export function plusWeek(user: User, now = Date.now()): number {
  const m = user.app_metadata || {};
  const from = Math.max(trialEnd(user), now, typeof m.plus_until === "number" ? m.plus_until * 1000 : 0);
  return Math.floor((from + TRIAL_DAYS * DAY_MS) / 1000);
}

// ─── Stripe ──────────────────────────────────────────────────────────────────

export const stripeClient = () => new Stripe(process.env.STRIPE_SECRET_KEY!);

/** Le client Stripe du compte : écrit par le webhook, sinon retrouvé par l'email (anciens comptes). */
export async function findCustomerId(stripe: Stripe, user: User): Promise<string | null> {
  if (user.app_metadata?.stripe_customer_id) return user.app_metadata.stripe_customer_id;
  if (!user.email) return null;
  const { data } = await stripe.customers.list({ email: user.email, limit: 1 });
  return data[0]?.id ?? null;
}

/** L'abonnement en cours du compte (pas les anciens résiliés). */
export async function currentSubscription(stripe: Stripe, user: User): Promise<Stripe.Subscription | null> {
  const customer = await findCustomerId(stripe, user);
  if (!customer) return null;
  const { data } = await stripe.subscriptions.list({ customer, status: "all", limit: 10 });
  return data.find(s => !["canceled", "incomplete_expired"].includes(s.status)) ?? null;
}

export const FOUNDER_SEATS = 500;

/** Places restantes au prix fondateur (29,99 €/an) : les 500 premiers abonnés annuels. */
export async function founderSeatsLeft(stripe: Stripe): Promise<number> {
  const price = process.env.STRIPE_PRICE_FOUNDER;
  if (!price) return 0;
  let taken = 0;
  for await (const sub of stripe.subscriptions.list({ price, status: "all", limit: 100 })) {
    if (sub.status !== "incomplete_expired") taken++;
    if (taken >= FOUNDER_SEATS) break;
  }
  return Math.max(0, FOUNDER_SEATS - taken);
}

/** Formule d'un abonnement, d'après son prix. */
export function planOf(sub: Stripe.Subscription): "month" | "year" | "founder" | null {
  const price = sub.items.data[0]?.price.id;
  if (price === process.env.STRIPE_PRICE_MONTHLY) return "month";
  if (price === process.env.STRIPE_PRICE_YEARLY) return "year";
  if (price === process.env.STRIPE_PRICE_FOUNDER) return "founder";
  // Ancien prix unique (4,99 €/mois) : on le traite comme un mensuel
  return sub.items.data[0]?.price.recurring?.interval === "year" ? "year" : "month";
}

/** Fin de la période payée (secondes). Stripe la met sur l'abonnement ou, depuis 2025, sur ses lignes. */
export function periodEnd(sub: Stripe.Subscription): number {
  const s = sub as Stripe.Subscription & { current_period_end?: number };
  return s.current_period_end ?? sub.items.data[0]?.current_period_end ?? 0;
}

/** Offre de lancement d'un code créateur : 1 mois offert, soit 3 mois de Plus pour 13,98 € payés d'avance, puis 6,99 €/mois. */
export const CREATOR_OFFER = { months: 3, cents: 1398 };

/** Le compte a utilisé un code créateur avec l'offre, et ne s'est encore jamais abonné */
export async function hasCreatorOffer(admin: SupabaseClient, user: User): Promise<boolean> {
  if (user.app_metadata?.stripe_customer_id) return false;
  const { data } = await admin.from("code_uses").select("plus_days, subscribed_at").eq("user_id", user.id).maybeSingle();
  return !!data && data.plus_days > 0 && !data.subscribed_at;
}

/** Même date le mois suivant (secondes). */
export const plusOneMonth = (s: number) => { const d = new Date(s * 1000); d.setMonth(d.getMonth() + 1); return Math.floor(d.getTime() / 1000); };

/** Un mois de Plus offert (parrainage). Abonné : la prochaine échéance recule d'un mois (période d'essai chez Stripe,
 *  pause comprise). Sinon, ou abonnement qui s'arrête : Plus sans paiement, à la suite de ce qui est déjà payé ou offert. */
export async function grantPlusMonth(admin: SupabaseClient, stripe: Stripe, userId: string): Promise<void> {
  const { data: { user } } = await admin.auth.admin.getUserById(userId);
  if (!user) return; // compte supprimé
  const m = user.app_metadata || {};
  const now = Math.floor(Date.now() / 1000);
  const given = typeof m.plus_until === "number" ? m.plus_until : 0;
  const sub = await currentSubscription(stripe, user);
  const meta: Record<string, number> = {};
  if (sub && ["active", "trialing"].includes(sub.status) && !sub.cancel_at_period_end) {
    const until = plusOneMonth(Math.max(sub.trial_end ?? 0, periodEnd(sub), now));
    await stripe.subscriptions.update(sub.id, { trial_end: until, proration_behavior: "none" });
    meta.plus_until = Math.max(given, until);
    // En pause : la reprise remet cette date, elle recule aussi
    if (typeof m.pause_renew === "number") meta.pause_renew = plusOneMonth(m.pause_renew);
  } else {
    meta.plus_until = plusOneMonth(Math.max(now, given, sub ? periodEnd(sub) : 0));
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: meta });
  if (error) throw error;
}
