// L'argent pour le dashboard de suivi (/admin) : ce que Stripe a vraiment encaissé, et ce que coûte Claude.
// Appelé par api/subscription.ts (action « finances », compte admin seulement) : Vercel n'accepte pas plus de 12 routes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { planOf } from "./_shared.js";

const DAY_S = 86_400;
const day = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);

// Les types de mouvements Stripe qui comptent (pas les virements vers la banque)
const PAID = ["charge", "payment"];
const REFUND = ["refund", "payment_refund"];
const FEE = ["stripe_fee", "tax_fee"];

export type Finances = {
  days: number;
  stripe: {
    gross: number; refunds: number; fees: number; net: number; payments: number;
    /** Revenu mensuel récurrent (centimes), les annuels comptés au douzième */
    mrr: number;
    active: { month: number; year: number; founder: number };
    byDay: { day: string; eur: number }[];
  } | null;
  claude: {
    usd: number; eur: number | null; byDay: { day: string; usd: number }[];
    /** Calculé d'après les tokens notés dans ai_usage (pas de clé admin), depuis cette date */
    estimated?: { since: string | null; calls: number };
  } | null;
  /** Pourquoi une partie manque : no_stripe, no_admin_key, claude_error, stripe_error */
  missing: string[];
};

async function stripeMoney(stripe: Stripe, since: number) {
  let gross = 0, refunds = 0, fees = 0, net = 0, payments = 0;
  const perDay = new Map<string, number>();
  for await (const t of stripe.balanceTransactions.list({ created: { gte: since }, limit: 100 })) {
    if (t.currency !== "eur") continue;
    if (PAID.includes(t.type)) {
      gross += t.amount; fees += t.fee; net += t.net; payments++;
      perDay.set(day(t.created), (perDay.get(day(t.created)) ?? 0) + t.amount);
    } else if (REFUND.includes(t.type)) {
      refunds += -t.amount; fees += t.fee; net += t.net;
    } else if (FEE.includes(t.type)) {
      fees += -t.amount; net += t.net;
    }
  }
  let mrr = 0;
  const active = { month: 0, year: 0, founder: 0 };
  for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
    const item = sub.items.data[0];
    const amount = (item?.price.unit_amount ?? 0) * (item?.quantity ?? 1);
    mrr += item?.price.recurring?.interval === "year" ? amount / 12 : amount;
    active[planOf(sub) ?? "month"]++;
  }
  const byDay = [...perDay].sort(([a], [b]) => a.localeCompare(b)).map(([d, c]) => ({ day: d, eur: c / 100 }));
  return { gross, refunds, fees, net, payments, mrr: Math.round(mrr), active, byDay };
}

/** Coûts de l'API Claude (rapport de coûts de l'Admin API : clé admin sk-ant-admin…, montants en cents de dollar) */
async function claudeCost(key: string, since: number) {
  const perDay = new Map<string, number>();
  let page: string | undefined;
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ starting_at: new Date(since * 1000).toISOString(), bucket_width: "1d", limit: "31" });
    if (page) q.set("page", page);
    const r = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${q}`, {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`cost_report ${r.status}`);
    const body = await r.json() as { data: { starting_at: string; results: { amount: string; currency: string }[] }[]; has_more: boolean; next_page?: string };
    for (const b of body.data) {
      const cents = b.results.filter(x => x.currency === "USD").reduce((t, x) => t + Number(x.amount || 0), 0);
      perDay.set(b.starting_at.slice(0, 10), (perDay.get(b.starting_at.slice(0, 10)) ?? 0) + cents / 100);
    }
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  const byDay = [...perDay].sort(([a], [b]) => a.localeCompare(b)).map(([d, usd]) => ({ day: d, usd: Math.round(usd * 100) / 100 }));
  return { usd: Math.round(byDay.reduce((t, d) => t + d.usd, 0) * 100) / 100, byDay };
}

// Prix Anthropic en dollars par million de tokens (entrée, sortie), octobre 2026. Écriture en cache : 1,25 × l'entrée,
// lecture du cache : 0,1 ×. Haiku 5.5 : ces prix valent jusqu'à 100 000 tokens par demande (les scans en sont loin).
const PRICES: [RegExp, number, number][] = [
  [/^claude-haiku-5/, 0.1, 0.5],
  [/^claude-haiku-4/, 1, 5],
  [/^claude-sonnet-5/, 2, 10],
  [/^claude-sonnet-4/, 3, 15],
  [/^claude-opus-5-5/, 4, 20],
  [/^claude-opus/, 5, 25],
];

type UsageRow = { created_at: string; model: string; input_tokens: number; output_tokens: number; cache_write_tokens: number; cache_read_tokens: number };

/** Sans clé admin : le coût d'après les tokens notés à chaque appel (api/_ai.ts → ai_usage) */
async function claudeEstimate(admin: SupabaseClient, since: number) {
  const perDay = new Map<string, number>();
  let calls = 0;
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await admin.from("ai_usage")
      .select("created_at, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens")
      .gte("created_at", new Date(since * 1000).toISOString()).order("id").range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as UsageRow[]) {
      const [, inP, outP] = PRICES.find(([re]) => re.test(r.model)) ?? PRICES[0];
      const usd = (r.input_tokens * inP + r.cache_write_tokens * inP * 1.25 + r.cache_read_tokens * inP * 0.1 + r.output_tokens * outP) / 1e6;
      perDay.set(r.created_at.slice(0, 10), (perDay.get(r.created_at.slice(0, 10)) ?? 0) + usd);
      calls++;
    }
    if ((data ?? []).length < 1000) break;
  }
  const { data: first } = await admin.from("ai_usage").select("created_at").order("id").limit(1).maybeSingle();
  const byDay = [...perDay].sort(([a], [b]) => a.localeCompare(b)).map(([d, usd]) => ({ day: d, usd: Math.round(usd * 10000) / 10000 }));
  return { usd: Math.round(byDay.reduce((t, d) => t + d.usd, 0) * 100) / 100, byDay, estimated: { since: (first?.created_at as string | undefined) ?? null, calls } };
}

/** Le taux du jour de la BCE (dollar → euro), null s'il ne répond pas */
async function usdToEur(): Promise<number | null> {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR", { signal: AbortSignal.timeout(5_000) });
    const body = await r.json() as { rates?: { EUR?: number } };
    return typeof body.rates?.EUR === "number" ? body.rates.EUR : null;
  } catch { return null; }
}

export async function finances(stripe: Stripe | null, admin: SupabaseClient, days: number): Promise<Finances> {
  const d = Math.min(Math.max(Math.round(days) || 30, 7), 180);
  // Même début que le reste du dashboard : minuit UTC, d jours en comptant aujourd'hui
  const since = Math.floor(Date.now() / 1000 / DAY_S) * DAY_S - (d - 1) * DAY_S;
  const missing: string[] = [];
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY?.trim();
  if (!stripe) missing.push("no_stripe");
  const [s, c, rate] = await Promise.all([
    stripe ? stripeMoney(stripe, since).catch(e => { console.error("finances stripe:", e); missing.push("stripe_error"); return null; }) : null,
    // Clé admin Anthropic : le coût facturé. Sinon : l'estimation d'après les tokens
    (adminKey ? claudeCost(adminKey, since) : claudeEstimate(admin, since))
      .catch(e => { console.error("finances claude:", e); missing.push(adminKey ? "claude_error" : "no_usage_table"); return null; }),
    usdToEur(),
  ]);
  return {
    days: d,
    stripe: s,
    claude: c ? { ...c, eur: rate ? Math.round(c.usd * rate * 100) / 100 : null } : null,
    missing,
  };
}
