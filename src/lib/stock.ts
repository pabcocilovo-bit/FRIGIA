// Assez ou pas ? La quantité d'une recette (recalculée pour les portions et les invités) comparée à ce qu'il y a
// dans Ma cuisine, ou sur la photo du scan. Seul ce qui se compare est comparé : poids (g, kg), volumes (ml, cl, l),
// pièces (« 3 », « 3 tomates »), ou la même unité (« 2 gousses »). « 1 paquet » face à « 500 g » : on montre ce que tu as.
import { norm, same } from "./shopping";

export type Stock = { name: string; qty: string };
type Amount = { v: number; u: string };

// Le sel, le poivre, l'eau, l'huile, les épices : jamais comptés
const BASICS = ["sel", "poivre", "eau", "huile", "epice"];

/** « 1,5 kg » → 1500 g, « 25 cl » → 250 ml, « 3 tomates » → 3 pièces. null : pas de nombre au début. */
export function amountOf(q: string, name = ""): Amount | null {
  const m = q.trim().replace(/^(environ|env\.?|~|≈)\s*/i, "").match(/^(\d+(?:[.,]\d+)?)?\s*(½)?\s*(.*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  const v = (m[1] ? parseFloat(m[1].replace(",", ".")) : 0) + (m[2] ? 0.5 : 0);
  const w = m[3].trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (["kg", "kilo", "kilos"].includes(w)) return { v: v * 1000, u: "g" };
  if (["g", "gr", "gramme", "grammes"].includes(w)) return { v, u: "g" };
  if (["l", "litre", "litres"].includes(w)) return { v: v * 1000, u: "ml" };
  if (w === "dl") return { v: v * 100, u: "ml" };
  if (w === "cl") return { v: v * 10, u: "ml" };
  if (w === "ml") return { v, u: "ml" };
  // « 3 », « 3 pièces », « 3 tomates » (le mot est le produit) : des pièces
  const nw = norm(w);
  if (!w || ["piece", "unite", "pc"].includes(nw[0] ?? "") || (nw.length > 0 && norm(name).includes(nw[0]))) return { v, u: "" };
  return { v, u: w.replace(/s$/, "") };
}

/** Le manque, arrondi au-dessus : 5 g près, une pièce entière. */
function fmtGap(v: number, u: string): string {
  const n = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");
  if (u === "g" || u === "ml") {
    const r = Math.ceil(v / 5) * 5;
    if (r >= 1000) return `${n(r / 1000)} ${u === "g" ? "kg" : "l"}`;
    return `${r} ${u}`;
  }
  const r = Math.ceil(v - 1e-6);
  return u ? `${r} ${u}${r > 1 ? "s" : ""}` : String(r);
}

/** Ce qu'il y a de ce produit. Même nom d'abord, sinon le premier mot (« poivron rouge » ≠ « chou rouge »). */
export function stockOf(name: string, stocks: Stock[]): Stock | undefined {
  const w = norm(name);
  if (!w.length) return undefined;
  return stocks.find(s => s.qty.trim() && same(s.name, name))
    ?? stocks.find(s => { const x = norm(s.name); return s.qty.trim() && x.length > 0 && (x.includes(w[0]) || w.includes(x[0])); });
}

/** have : ce que tu as (« 300 g ») ; short : ce qui manque (« 200 g »), null si assez ou si on ne peut pas comparer ;
 *  sure : les deux quantités se comparent. null : ce produit n'est pas dans ta cuisine avec une quantité. */
export type QtyCheck = { have: string; short: string | null; sure: boolean };
export function checkQty(need: string, name: string, stocks: Stock[]): QtyCheck | null {
  if (norm(name).some(x => BASICS.includes(x))) return null;
  const s = stockOf(name, stocks);
  if (!s) return null;
  const a = amountOf(need, name), b = amountOf(s.qty, s.name);
  if (!a || !b || a.u !== b.u) return { have: s.qty, short: null, sure: false };
  const gap = a.v - b.v;
  return { have: s.qty, short: gap > 1e-6 ? fmtGap(gap, a.u) : null, sure: true };
}
