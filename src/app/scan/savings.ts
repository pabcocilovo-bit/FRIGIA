// Ce que « J'ai cuisiné ça » compte, en kilos et en euros (poids par pièce, prix moyen au kilo par famille d'aliments) :
// - cuisiné de ton frigo : les produits frais déjà là (légumes, fruits, laitiers, viande, poisson, œufs) ;
// - sauvé : parmi eux, ceux marqués « À finir » au scan, qui allaient se perdre.
// Le placard, les condiments et ce qu'on ne reconnaît pas ne comptent pas.
import type { SavedItem } from "../../lib/cooked";
import type { DetectedIngredient, GeneratedRecipe } from "../../lib/types";
import { inFridge, words } from "./portions";

// Pas du gaspillage évité : l'assaisonnement et le placard sec
const SKIP = ["sel", "poivre", "eau", "epice", "pate", "penne", "spaghetti", "tagliatelle", "fusilli", "riz", "huile", "farine", "sucre",
  "vinaigre", "moutarde", "bouillon", "coco", "cumin", "paprika", "curry", "cannelle", "muscade", "thym", "laurier", "origan", "levure", "maizena", "semoule"];

// Grammes par pièce (« 2 courgettes »)
const PIECE: [string, number][] = [
  ["oeuf", 55], ["tomate", 120], ["cerise", 15], ["courgette", 250], ["oignon", 100], ["echalote", 30], ["carotte", 100],
  ["pomme", 150], ["terre", 150], ["poivron", 160], ["aubergine", 300], ["avocat", 170], ["citron", 100], ["banane", 120],
  ["concombre", 300], ["poireau", 200], ["champignon", 20], ["brocoli", 400], ["chou", 600], ["salade", 300], ["laitue", 300],
  ["escalope", 150], ["filet", 150], ["blanc", 150], ["cuisse", 200], ["steak", 125], ["saucisse", 80], ["merguez", 70],
  ["yaourt", 125], ["mozzarella", 125], ["camembert", 250], ["patate", 150], ["navet", 120], ["fenouil", 250], ["mangue", 300],
  ["orange", 180], ["poire", 160], ["peche", 150], ["abricot", 50], ["tortilla", 40], ["pain", 250], ["ail", 5],
];

// Prix moyen au kilo en grande surface, TTC, année 2024 : Observatoire de la formation des prix et des marges
// (FranceAgriMer, rapport au Parlement 2025, d'après RNM et Kantar). Quand l'Observatoire ne publie pas le produit,
// on prend le prix publié le plus proche et le plus bas, pour ne jamais gonfler le chiffre (marqué « estimé »).
// La première ligne qui correspond l'emporte. Troisième colonne : un mot qui doit aussi être là (« filet » de poulet).
// words() retire le s final : « pois », « radis », « maïs » s'écrivent ici sans.
const POULTRY = ["poulet", "dinde", "volaille"];
const PRICE: [string[], number, string[]?][] = [
  // Lieu noir en découpe 11,74 ; les autres poissons, estimé au même prix
  [["saumon", "thon", "cabillaud", "poisson", "crevette", "colin", "sardine", "maquereau", "truite", "lieu", "merlu", "moule"], 11.74],
  // Jambon cuit libre-service 14,26 ; lardons, bacon, chorizo estimés pareil
  [["jambon", "lardon", "bacon", "chorizo"], 14.26],
  // Poulet : escalope ou filet 11,02, cuisse 4,73, entier label rouge 6,46
  [["filet", "escalope", "blanc", "aiguillette"], 11.02, POULTRY],
  [["escalope"], 11.02],
  [["cuisse", "pilon"], 4.73, POULTRY],
  [POULTRY, 6.46],
  // Viande hachée de bœuf 15 % MG 13,41 ; les autres viandes rouges, estimé pareil
  [["boeuf", "steak", "hache", "veau", "agneau", "viande", "canard", "magret"], 13.41],
  // Longe de porc 8,19 ; saucisses estimées pareil
  [["porc", "longe", "echine", "saucisse", "merguez"], 8.19],
  // Fromage blanc, yaourt, crème : panier laitier 2,31 (estimé, l'Observatoire ne détaille pas leur prix)
  [["blanc", "frai"], 2.31, ["fromage"]],
  [["yaourt", "creme", "skyr", "faisselle", "suisse"], 2.31],
  // Bûchette de chèvre 11,30 ; les autres fromages, estimé pareil
  [["fromage", "parmesan", "emmental", "comte", "mozzarella", "feta", "chevre", "gruyere", "cheddar", "ricotta", "mascarpone",
    "raclette", "reblochon", "camembert", "brie", "roquefort", "burrata", "halloumi"], 11.3],
  [["beurre"], 9.82],
  [["lait"], 1.09],
  // Œufs : estimé (l'Observatoire ne les suit pas), environ 0,27 € l'œuf
  [["oeuf"], 5],
  // Pomme de terre 1,63
  [["terre", "patate"], 1.63],
  // Panier de légumes 2,51 (avant les fruits : « tomate cerise » est un légume)
  [["tomate", "courgette", "oignon", "echalote", "carotte", "poivron", "aubergine", "concombre", "poireau", "champignon",
    "brocoli", "chou", "salade", "laitue", "epinard", "haricot", "poi", "radi", "navet", "fenouil", "potiron", "courge",
    "butternut", "betterave", "celeri", "legume", "persil", "basilic", "coriandre", "menthe", "ciboulette", "mai",
    "endive", "artichaut", "asperge", "blette", "roquette", "mache", "panai"], 2.51],
  // Panier de fruits 3,45
  [["pomme", "avocat", "citron", "banane", "mangue", "orange", "poire", "peche", "abricot", "fraise", "framboise", "fruit",
    "kiwi", "raisin", "melon", "pasteque", "cerise", "clementine", "prune", "myrtille", "ananas"], 3.45],
];
const has = (w: string[], list: string[]) => w.some(x => list.includes(x));
/** Prix au kilo d'un produit frais, null pour le reste (pas compté) */
const pricePerKg = (w: string[]) => PRICE.find(([list, , also]) => has(w, list) && (!also || has(w, also)))?.[1] ?? null;

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

export type Amount = { kg: number; eur: number };
/** items : le détail de « sauvé », produit par produit */
export type Counted = { used: Amount; saved: Amount; items: SavedItem[] };

const round = (g: number, eur: number): Amount => ({ kg: Math.round(g / 100) / 10, eur: Math.round(eur * 100) / 100 });

/** Cuisiné de ton frigo et sauvé, pour cette recette en n portions. found : les ingrédients du scan (avec « À finir »). */
export function countCooked(r: GeneratedRecipe, servings: number, found?: DetectedIngredient[]): Counted {
  const lines = r.items?.length
    ? r.items.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, have: i.have, factor: servings / (r.serves || servings || 1) }))
    : (r.recipeIngredients ?? []).map(i => ({ name: i.name, ...parseQty(i.qty), have: !!found?.length && inFridge(i.name, found), factor: 1 }));
  const toFinish = (found ?? []).filter(f => f.finish);
  let g = 0, eur = 0, sg = 0, seur = 0;
  const items: SavedItem[] = [];
  for (const l of lines) {
    const w = words(l.name);
    if (!l.have || !w.length || has(w, SKIP)) continue;
    const price = pricePerKg(w);
    if (price == null) continue;
    const lg = grams(w, l.qty, l.unit) * l.factor, le = (lg / 1000) * price;
    g += lg; eur += le;
    if (toFinish.length && inFridge(l.name, toFinish)) { sg += lg; seur += le; items.push({ name: l.name, ...round(lg, le) }); }
  }
  return { used: round(g, eur), saved: round(sg, seur), items };
}

/** « 4,20 € », « 0,9 kg » */
export const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
export const kilos = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;
