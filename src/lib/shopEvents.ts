// Ce que la personne fait de sa liste de courses (dashboard de suivi > Courses) : ajout, coche, décoche, retrait.
// Calculé en comparant la liste avant / après, au moment où elle part sur le compte : un article ajouté puis retiré
// dans la demi-seconde ne compte pas. Envoyé sans attendre ; si la table manque ou le réseau coupe, rien n'est gardé.
import { supabase } from "../supabase";
import type { ShopItem } from "./home";
import { BY_HAND } from "./shopping";

type Kind = "ajout" | "coche" | "decoche" | "retrait";
type Row = { kind: Kind; source: "recette" | "main"; item: string };

const label = (x: ShopItem) => x.name.trim().toLowerCase().slice(0, 80);
const source = (x: ShopItem): Row["source"] => (x.from === BY_HAND ? "main" : "recette");

export function shopDiff(before: ShopItem[], after: ShopItem[]): Row[] {
  const old = new Map(before.map(x => [x.id, x]));
  const now = new Set(after.map(x => x.id));
  const rows: Row[] = [];
  const push = (kind: Kind, x: ShopItem) => { if (label(x)) rows.push({ kind, source: source(x), item: label(x) }); };
  for (const x of after) {
    const o = old.get(x.id);
    if (!o) { push("ajout", x); if (x.done) push("coche", x); }
    else if (!o.done && x.done) push("coche", x);
    else if (o.done && !x.done) push("decoche", x);
  }
  // Un article coché qu'on retire (« Retirer les articles cochés ») est acheté, pas abandonné : pas compté
  for (const x of before) if (!now.has(x.id) && !x.done) push("retrait", x);
  return rows.slice(0, 200);
}

export function logShop(before: ShopItem[], after: ShopItem[]) {
  const rows = shopDiff(before, after);
  if (!rows.length) return;
  void Promise.resolve(supabase.from("shop_events").insert(rows)).catch(() => { /* rien : un chiffre de suivi en moins */ });
}
