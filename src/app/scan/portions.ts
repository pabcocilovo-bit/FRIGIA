// Portions et quantités : « Pour 4 personnes » (Gratuit), « 2 portions » (Plus, un enfant compte pour une demi),
// et les quantités de la recette recalculées pour ce nombre.
import type { GeneratedRecipe, RecipeItem } from "../../lib/types";
import type { ScanState } from "./store";

export const num = (n: number) => String(n).replace(".", ",");

/** En Plus : toi, et les invités (le foyer arrive à l'étape 10). En Gratuit : « Pour combien ? ». */
export const portions = (isPlus: boolean, s: Pick<ScanState, "servings" | "guests">) => (isPlus ? 1 + s.guests : s.servings);

export const srvLabel = (isPlus: boolean, n: number) =>
  isPlus ? `${num(n)} portion${n > 1 ? "s" : ""}` : `${n} personne${n > 1 ? "s" : ""}`;

const COUNTED = ["", "gousse", "gousses", "feuilles", "tranches", "tranche"];

/** « 200 g » / « 1 » / « ½ » et le nom au singulier ou au pluriel, pour n portions. */
export function itemText(it: RecipeItem, factor: number): { q: string; n: string } {
  if (it.qty == null) return { q: "", n: it.name };
  let v = it.qty * factor;
  if (it.unit === "g" || it.unit === "ml") {
    v = Math.max(5, Math.round(v / 5) * 5);
    return { q: `${v} ${it.unit}`, n: it.name };
  }
  if (COUNTED.includes(it.unit)) v = Math.max(1, Math.round(v));
  const r = Math.round(v * 2) / 2, whole = Math.floor(r), half = r - whole > 0;
  const s = (whole ? String(whole) : "") + (half ? "½" : "") || "½";
  let u = it.unit;
  if (u === "gousse" && r > 1) u = "gousses";
  if (u === "tranche" && r > 1) u = "tranches";
  return { q: u ? `${s} ${u}` : s, n: !it.unit && r > 1 ? it.plural : it.name };
}

/** Lignes d'ingrédients d'une recette, nouvelles (items) ou anciennes (recipeIngredients, quantités écrites). */
export function recipeLines(r: GeneratedRecipe, servings: number): { q: string; n: string; have: boolean }[] {
  if (r.items?.length) {
    const factor = servings / (r.serves || servings || 1);
    return r.items.map(it => ({ ...itemText(it, factor), have: it.have }));
  }
  return (r.recipeIngredients ?? []).map(i => ({ q: i.qty, n: i.name, have: true }));
}

/** « 6 sur 8 » : ce que tu as déjà, sur le total. */
export function haveCount(r: GeneratedRecipe): { have: number; total: number } {
  const items = r.items ?? [];
  return { have: items.filter(i => i.have).length, total: items.length };
}

export const minutesOf = (r: GeneratedRecipe) => r.minutes ?? (parseInt(r.time, 10) || 0);
