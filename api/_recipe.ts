// Une recette de l'IA, vérifiée et mise en forme pour l'appli : le scan (recipes.ts) et Explorer (dish.ts).
import { dishPhoto, extractFirstJSON } from "./_ai.js";

type RawItem = { name?: unknown; plural?: unknown; qty?: unknown; unit?: unknown; have?: unknown };
type RawStep = { text?: unknown; timer?: { label?: unknown; min?: unknown } | null } | string;

/** Ingrédients et étapes lisibles d'une recette de l'IA, ou null s'il en manque (moins de 2 de chaque).
 *  noShop (« Zéro course ») : null aussi si un ingrédient est à acheter. */
export function parse(r: RawRecipe | null | undefined, noShop = false) {
  if (!r || !str(r.title, 80)) return null;
  const items = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .map(i => (typeof i === "string" ? { name: i } : i))
    .filter(i => str(i?.name, 60)).map(i => ({
      name: str(i.name, 60),
      plural: str(i.plural, 60) || str(i.name, 60),
      qty: num(i.qty),
      unit: str(i.unit, 20),
      have: i.have !== false,
    }));
  const steps = (Array.isArray(r.steps) ? r.steps : []).map(s => (typeof s === "string" ? { text: s, timer: null } : s))
    .filter(s => str(s?.text, 400))
    .map(s => {
      const min = num(s.timer?.min);
      return { text: str(s.text, 400), timer: min ? { label: str(s.timer?.label, 30) || "Minuteur", min: Math.round(min) } : null };
    });
  if (items.length < 2 || steps.length < 2) return null;
  if (noShop && items.some(i => !i.have)) return null;
  if (missingFromTitle(str(r.title, 80), items.map(i => i.name)).length) return null;
  return { r, title: str(r.title, 80), items, steps };
}
export type RawRecipe = {
  title?: unknown; intro?: unknown; minutes?: unknown; time?: unknown; calories?: unknown; kcal?: unknown; difficulty?: unknown; imageSearch?: unknown;
  veg?: unknown; oven?: unknown; cold?: unknown; kids?: unknown; missing?: unknown; origin?: unknown; ingredients?: (RawItem | string)[]; steps?: RawStep[];
};

export const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const strs = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map(x => str(x, max)).filter(Boolean).slice(0, n) : []);
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/s\b/g, "");
// Un nombre, ou un texte qui commence par un nombre ("20 min", "450 kcal")
export const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};

// Aliments qu'un titre peut nommer : s'il en nomme un, il doit être dans les ingrédients
// (« Riz sauté aux œufs et petits pois » sans petits pois n'est pas montré). Pas de mot qu'un morceau ou une variété remplace
// dans la liste (porc et filet mignon, fromage et emmental).
const FOODS = ["pois", "petit pois", "pois chiche", "haricot", "lentille", "champignon", "poulet", "dinde",
  "jambon", "lardon", "bacon", "chorizo", "saucisse", "merguez", "saumon", "thon", "cabillaud", "colin", "crevette", "moule",
  "sardine", "maquereau", "tomate", "courgette", "aubergine", "poivron", "carotte", "pomme de terre", "patate", "epinard", "brocoli",
  "chou-fleur", "chou", "poireau", "oignon", "echalote", "potiron", "courge", "butternut", "betterave", "concombre", "avocat",
  "mozzarella", "parmesan", "chevre", "feta", "comte", "emmental", "gruyere", "ricotta", "raclette", "reblochon", "camembert",
  "riz", "quinoa", "semoule", "boulgour", "gnocchi", "tofu", "oeuf", "pomme", "poire", "banane", "fraise", "framboise", "myrtille",
  "citron", "orange", "abricot", "peche", "ananas", "mangue", "chocolat", "noisette", "amande", "noix", "coco", "miel", "yaourt"];
// Minuscules, sans accent ni s final, mots séparés par des espaces (« Petits pois » : " petit poi ")
const words = (s: string) => ` ${norm(s.replace(/œ/g, "oe").replace(/Œ/g, "oe")).replace(/[^a-z-]+/g, " ").trim()} `;
const FOOD_WORDS = FOODS.map(f => words(f).trim());
/** Les aliments que le titre nomme et qui ne sont pas dans la liste (le plus long d'abord : « pois chiche » avant « pois »).
 *  Un aliment en deux mots est trouvé par son dernier mot (« petits pois » avec « pois »). */
function missingFromTitle(title: string, names: string[]): string[] {
  const t = words(title), all = names.map(words).join("|");
  const named = FOOD_WORDS.filter(f => t.includes(` ${f} `)).sort((a, b) => b.length - a.length)
    .filter((f, i, l) => !l.slice(0, i).some(g => g.includes(f)));
  return named.filter(f => !all.includes(` ${f} `) && !all.includes(` ${f.split(" ").pop()} `));
}

/** Les recettes complètes d'une réponse coupée en route (trop longue) : chaque objet entier de la liste. */
export function salvage(text: string): RawRecipe[] {
  const list = text.indexOf("[", text.indexOf('"recipes"'));
  if (list === -1) return [];
  const out: RawRecipe[] = [];
  let at = list + 1;
  for (let obj = extractFirstJSON(text, at); obj; obj = extractFirstJSON(text, at)) {
    at = text.indexOf(obj, at) + obj.length;
    try { out.push(JSON.parse(obj) as RawRecipe); } catch { break; }
  }
  return out;
}

/** La recette envoyée à l'appli (lib/scan.ts, toRecipe), avec sa photo. */
export async function shape(r: RawRecipe, items: Parsed["items"], steps: Parsed["steps"], servings: number, extra: Record<string, unknown> = {}) {
  const imageSearch = str(r.imageSearch, 40) || str(r.title, 80);
  return {
    title: str(r.title, 80),
    intro: str(r.intro, 300),
    minutes: Math.round(num(r.minutes ?? r.time) ?? 20),
    calories: Math.round(num(r.calories ?? r.kcal) ?? 400),
    difficulty: ["Facile", "Moyen", "Difficile"].includes(str(r.difficulty, 20)) ? str(r.difficulty, 20) : "Facile",
    imageSearch,
    imageUrl: await dishPhoto(imageSearch),
    veg: r.veg === true, oven: r.oven === true, cold: r.cold === true,
    missing: str(r.missing, 120),
    origin: str(r.origin, 40),
    serves: servings,
    items,
    steps,
    ...extra,
  };
}
type Parsed = NonNullable<ReturnType<typeof parse>>;
