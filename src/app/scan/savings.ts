// Ce que « J'ai cuisiné ça » a sauvé : le poids des ingrédients déjà là (ceux du frigo), et ce qu'ils auraient coûté.
// Estimation simple : poids par pièce, prix moyen au kilo par famille d'aliments. Sel, eau, épices et placard ne comptent pas.
import type { DetectedIngredient, GeneratedRecipe } from "../../lib/types";
import { inFridge, words } from "./portions";

// Pas du gaspillage évité : l'assaisonnement et le placard sec
const SKIP = ["sel", "poivre", "eau", "epice", "pate", "penne", "spaghetti", "tagliatelle", "fusilli", "riz", "huile", "farine", "sucre",
  "vinaigre", "moutarde", "bouillon", "cumin", "paprika", "curry", "cannelle", "muscade", "thym", "laurier", "origan", "levure", "maizena", "semoule"];

// Grammes par pièce (« 2 courgettes »)
const PIECE: [string, number][] = [
  ["oeuf", 55], ["tomate", 120], ["cerise", 15], ["courgette", 250], ["oignon", 100], ["echalote", 30], ["carotte", 100],
  ["pomme", 150], ["terre", 150], ["poivron", 160], ["aubergine", 300], ["avocat", 170], ["citron", 100], ["banane", 120],
  ["concombre", 300], ["poireau", 200], ["champignon", 20], ["brocoli", 400], ["chou", 600], ["salade", 300], ["laitue", 300],
  ["escalope", 150], ["filet", 150], ["blanc", 150], ["cuisse", 200], ["steak", 125], ["saucisse", 80], ["merguez", 70],
  ["yaourt", 125], ["mozzarella", 125], ["camembert", 250], ["patate", 150], ["navet", 120], ["fenouil", 250], ["mangue", 300],
  ["orange", 180], ["poire", 160], ["peche", 150], ["abricot", 50], ["tortilla", 40], ["pain", 250], ["ail", 5],
];

// Prix moyen au kilo (words() retire le s final : « pois », « radis », « maïs » s'écrivent ici sans)
const PRICE: [string[], number][] = [
  [["saumon", "thon", "cabillaud", "poisson", "crevette", "colin", "sardine", "maquereau", "truite", "lieu", "merlu", "moule"], 18],
  [["poulet", "boeuf", "porc", "veau", "agneau", "dinde", "lardon", "jambon", "saucisse", "merguez", "steak", "bacon", "chorizo",
    "viande", "hache", "escalope", "canard", "magret", "cuisse"], 14],
  [["fromage", "parmesan", "emmental", "comte", "mozzarella", "feta", "chevre", "gruyere", "cheddar", "ricotta", "mascarpone",
    "raclette", "reblochon", "camembert", "brie", "roquefort", "burrata", "halloumi"], 13],
  [["beurre"], 10],
  [["oeuf"], 5],
  [["lait", "creme", "yaourt", "skyr"], 2.5],
  [["tomate", "courgette", "oignon", "echalote", "carotte", "pomme", "terre", "poivron", "aubergine", "avocat", "citron", "banane",
    "concombre", "poireau", "champignon", "brocoli", "chou", "salade", "laitue", "epinard", "haricot", "poi", "radi",
    "navet", "fenouil", "potiron", "courge", "butternut", "betterave", "celeri", "legume", "fruit", "mangue", "orange", "poire",
    "peche", "abricot", "fraise", "framboise", "persil", "basilic", "coriandre", "menthe", "ciboulette", "patate", "mai"], 3],
];
const DEFAULT_PRICE = 4;

const has = (w: string[], list: string[]) => w.some(x => list.includes(x));
const pricePerKg = (w: string[]) => PRICE.find(([list]) => has(w, list))?.[1] ?? DEFAULT_PRICE;

/** Poids en grammes d'une quantité « 200 g », « 2 », « 1 c. à s. »… */
function grams(name: string[], qty: number | null, unit: string): number {
  if (qty == null) return 20; // « un peu »
  switch (unit.trim().toLowerCase()) {
    case "g": return qty;
    case "kg": return qty * 1000;
    case "ml": return qty;
    case "cl": return qty * 10;
    case "l": return qty * 1000;
    case "c. à s.": return qty * 15;
    case "c. à c.": return qty * 5;
    case "gousse": case "gousses": return qty * 5;
    case "feuilles": case "feuille": return qty * 2;
    case "tranches": case "tranche": return qty * 30;
    case "": return qty * (PIECE.find(([k]) => name.includes(k))?.[1] ?? 100);
    default: return qty * 50;
  }
}

/** « 200 g », « 2 », « 1 c. à s. » écrits par les anciennes recettes */
function parseQty(text: string): { qty: number | null; unit: string } {
  const m = text.trim().replace(",", ".").match(/^(\d+(?:\.\d+)?|½)\s*(.*)$/);
  if (!m) return { qty: null, unit: "" };
  return { qty: m[1] === "½" ? 0.5 : Number(m[1]), unit: m[2] };
}

export type Saved = { kg: number; eur: number };

/** Kilos et euros sauvés en cuisinant cette recette pour n portions. found : les ingrédients du scan (anciennes recettes). */
export function savedBy(r: GeneratedRecipe, servings: number, found?: DetectedIngredient[]): Saved {
  const lines = r.items?.length
    ? r.items.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, have: i.have, factor: servings / (r.serves || servings || 1) }))
    : (r.recipeIngredients ?? []).map(i => ({ name: i.name, ...parseQty(i.qty), have: !found?.length || inFridge(i.name, found), factor: 1 }));
  let g = 0, eur = 0;
  for (const l of lines) {
    const w = words(l.name);
    if (!l.have || !w.length || has(w, SKIP)) continue;
    const lg = grams(w, l.qty, l.unit) * l.factor;
    g += lg;
    eur += (lg / 1000) * pricePerKg(w);
  }
  return { kg: Math.round(g / 100) / 10, eur: Math.round(eur * 100) / 100 };
}

/** « 4,20 € », « 0,9 kg » */
export const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
export const kilos = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;
