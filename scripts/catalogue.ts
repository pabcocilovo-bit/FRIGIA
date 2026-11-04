// Le catalogue d'Explorer écrit à l'avance (supabase/catalogue/plats-*.json) devient du SQL à lancer dans Supabase.
// Chaque plat : la classique et 2 variantes. Les catégories (« recettes rapides »…) et les ingrédients (« saumon »…)
// sont tirés de ces plats. Vérifie aussi chaque recette, comme le serveur le fait pour l'IA.
//
// Lancer : npm run catalogue  → supabase/catalogue/sql/catalogue-01.sql, -02… (à coller dans Supabase, dans l'ordre)
// L'appli en anglais : npm run catalogue -- --en  → sql/catalogue-en-01.sql… depuis supabase/catalogue/en/plats-*.json
//   (chaque plat y a son nom anglais « q » et son nom français « fr »). Les lignes vont sous les clés françaises précédées
//   de « en: » (api/_catalog.ts) : Explorer range les plats anglais comme les français. Les noms anglais sont des alias.
//
// Une recette, dans le fichier : [titre, variante, ce qui change, accroche, origine, minutes, kcal, difficulté (F, M ou D),
//   photo en anglais, repères, ingrédients, étapes]
// - repères : v végé, o four, c se mange froid, d dessert, h healthy, b petit budget, f plaît aux enfants, e entrée
// - ingrédient : "nom|pluriel|quantité|unité" (pluriel vide : le nom avec un s ; quantité vide : « un peu »)
// - étape : "texte" ou "texte|minuteur|minutes"
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOG_SERVES, type CatalogRecipe, catalogKey, EN } from "../api/_catalog.js";
import { parse, type RawRecipe } from "../api/_recipe.js";

type Compact = [string, string, string, string, string, number, number, "F" | "M" | "D", string, string, string[], string[]];
type Dish = { q: string; a?: string[]; fr?: string; r: Compact[] };
type Row = { key: string; query: string; aliases: string[]; kind: "dish" | "list"; recipes: CatalogRecipe[] };

const ROOT = "supabase/catalogue";
const ENGLISH = process.argv.includes("--en");
const DIR = ENGLISH ? join(ROOT, "en") : ROOT;
const pre = ENGLISH ? EN : "";
const CLASSIC = ENGLISH ? "The classic" : "La classique";
// Ce que fait une recette en pièces, pour 4 portions (Hugo, 28 octobre) : « Crêpes » → 15 crêpes. Titre → [nombre, une, plusieurs]
const PIECES = JSON.parse(readFileSync(join(DIR, "pieces.json"), "utf8")) as Record<string, [number, string, string]>;
const UNITS = ENGLISH ? ["g", "ml", "cl", "tbsp", "tsp", "clove", "leaves", "slices", ""] : ["g", "ml", "cl", "c. à s.", "c. à c.", "gousse", "feuilles", "tranches", ""];
const DIFF = { F: "Facile", M: "Moyen", D: "Difficile" } as const;
const errors: string[] = [];

const pluralOf = (name: string) => {
  const [first, ...rest] = name.split(" ");
  const p = /[sxz]$/.test(first) ? first : /(eau|au)$/.test(first) ? `${first}x` : `${first}s`;
  return [p, ...rest].join(" ");
};

/** Une recette du fichier, au format de l'appli (api/_recipe.ts, shape) */
function recipe(c: Compact, where: string): (CatalogRecipe & { tags: string }) | null {
  if (!Array.isArray(c) || c.length !== 12) { errors.push(`${where} : 12 champs attendus`); return null; }
  const [title, variant, change, intro, origin, minutes, kcal, diff, imageSearch, flags, ings, steps] = c;
  const raw: RawRecipe = {
    title,
    ingredients: ings.map(s => {
      const [name, plural, qty, unit = ""] = s.split("|");
      if (!UNITS.includes(unit)) errors.push(`${where} « ${title} » : unité « ${unit} » (${s})`);
      if (s.split("|").length !== 4) errors.push(`${where} « ${title} » : ingrédient mal écrit (${s})`);
      return { name, plural: plural || pluralOf(name), qty: qty ? Number(qty) : null, unit, have: false };
    }),
    steps: steps.map(s => {
      const [text, label, min] = s.split("|");
      return { text, timer: label ? { label, min: Number(min) } : null };
    }),
  };
  const p = parse(raw);
  if (!p) { errors.push(`${where} « ${title} » : ingrédients ou étapes manquants, ou un aliment du titre absent des ingrédients`); return null; }
  if (steps.length < 3 || steps.length > 8) errors.push(`${where} « ${title} » : ${steps.length} étapes (3 à 8)`);
  if (!intro || !(minutes > 0) || !(kcal > 0) || !DIFF[diff] || !/^[a-z ]+$/.test(imageSearch)) errors.push(`${where} « ${title} » : accroche, minutes, kcal, difficulté ou photo`);
  if (p.items.some(i => i.qty != null && !(i.qty > 0))) errors.push(`${where} « ${title} » : quantité illisible`);
  const has = (f: string) => flags.includes(f);
  return {
    title, intro, minutes, calories: kcal, difficulty: DIFF[diff], imageSearch,
    veg: has("v"), oven: has("o"), cold: has("c"), missing: "", origin, serves: CATALOG_SERVES,
    items: p.items, steps: p.steps,
    ...(has("f") ? { kids: true } : {}), ...(has("d") ? { dessert: true } : {}),
    ...(PIECES[title] ? { makes: { n: PIECES[title][0], one: PIECES[title][1], many: PIECES[title][2] } } : {}),
    variant, change,
    tags: flags,
  };
}

const without = (r: CatalogRecipe & { tags: string }, keys: string[]) =>
  Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))) as CatalogRecipe;

const rows: Row[] = [];
const taken = new Set<string>();
const all: (CatalogRecipe & { tags: string })[] = [];
const files = readdirSync(DIR).filter(f => /^plats-\d+\.json$/.test(f)).sort();
for (const f of files) {
  const dishes = JSON.parse(readFileSync(join(DIR, f), "utf8")) as Dish[];
  for (const d of dishes) {
    // En anglais : la clé du plat français (Explorer le retrouve pareil), le nom anglais en alias
    const key = pre + catalogKey(ENGLISH ? d.fr ?? "" : d.q);
    const where = `${f} ${d.q}`;
    if (ENGLISH && !d.fr) { errors.push(`${where} : « fr » manquant`); continue; }
    if (taken.has(key)) { errors.push(`${where} : déjà dans le catalogue (${key})`); continue; }
    const recipes = d.r.map(c => recipe(c, where)).filter(r => r !== null);
    if (recipes.length !== 3 || recipes[0].variant !== CLASSIC || recipes.slice(1).some(r => !r.variant || !r.change)) {
      errors.push(`${where} : la classique puis 2 variantes (avec ce qui change)`);
    }
    const aliases = [...new Set([...(ENGLISH ? [d.q] : []), ...(d.a ?? [])].map(a => pre + catalogKey(a)))].filter(a => a !== pre && a !== key && !taken.has(a));
    for (const k of [key, ...aliases]) taken.add(k);
    all.push(...recipes);
    rows.push({ key, query: d.q, aliases, kind: "dish", recipes: recipes.map(r => without(r, ["tags"])) });
  }
}

// Les catégories d'Explorer (src/app/Explore.tsx) et d'autres façons de les demander : une réserve de recettes
const MAX = 30;
const isDessert = (r: { tags: string }) => r.tags.includes("d");
const LISTS: [string, string[], (r: CatalogRecipe & { tags: string }) => boolean][] = [
  ["recettes rapides", ["rapide", "recette express", "express", "plat rapide", "vite fait"], r => r.minutes as number <= 25 && !isDessert(r)],
  ["recettes healthy", ["healthy", "leger", "recette legere", "sain", "equilibre", "light"], r => r.tags.includes("h")],
  ["recettes petit budget", ["petit budget", "pas cher", "economique", "budget"], r => r.tags.includes("b")],
  ["plats en famille qui plaisent aux enfants", ["famille", "enfant", "recette enfant", "plat enfant", "pour les enfants"], r => r.tags.includes("f") && !isDessert(r)],
  ["desserts", ["dessert", "sucre", "gouter"], isDessert],
  ["entrées", ["entree"], r => r.tags.includes("e")],
  ["plats", ["plat", "plat principal"], r => !isDessert(r) && !r.tags.includes("e")],
  ["végétarien", ["vege", "veggie", "vegetarienne", "sans viande"], r => r.veg === true && !isDessert(r)],
];
// Les ingrédients qu'on cherche souvent : les recettes qui en ont. Certains se cherchent par famille (« pâtes », « fromage »).
const FAMILIES: Record<string, string[]> = {
  "pâtes": ["pates", "spaghetti", "penne", "tagliatelle", "fusilli", "coquillette", "macaroni", "linguine", "farfalle", "feuille de lasagne", "pates complete"],
  fromage: ["fromage", "emmental", "comte", "gruyere", "mozzarella", "parmesan", "chevre", "feta", "reblochon", "raclette", "camembert",
    "roquefort", "gorgonzola", "ricotta", "maroille", "cheddar", "pecorino", "burrata", "halloumi"],
  "poisson": ["saumon", "cabillaud", "thon", "colin", "merlu", "dorade", "lieu", "truite", "sardine", "maquereau", "lotte", "sole", "bar"],
};
// En anglais : les mêmes réserves (sous leur clé française), cherchées par leur nom anglais et trouvées par les mots anglais
const LIST_EN: Record<string, string[]> = {
  "recettes rapides": ["quick recipes", "quick", "quick and easy", "fast"], "recettes healthy": ["healthy recipes", "healthy", "light", "low calorie"],
  "recettes petit budget": ["budget recipes", "budget", "cheap", "cheap meals"], "plats en famille qui plaisent aux enfants": ["family dishes kids love", "family", "kids", "for kids"],
  desserts: ["desserts", "dessert", "sweet"], "entrées": ["starters", "starter"], plats: ["main dishes", "mains", "main"],
  "végétarien": ["vegetarian", "veggie", "meat free"],
};
const FAMILIES_EN: Record<string, string[]> = {
  "pâtes": ["pasta", "spaghetti", "penne", "tagliatelle", "fusilli", "macaroni", "linguine", "farfalle", "lasagne", "rigatoni", "conchiglie"],
  fromage: ["cheese", "emmental", "comte", "gruyere", "mozzarella", "parmesan", "goat cheese", "goats cheese", "feta", "reblochon", "raclette",
    "camembert", "roquefort", "gorgonzola", "ricotta", "cheddar", "pecorino", "burrata", "halloumi"],
  poivron: ["bell pepper", "red pepper", "green pepper", "yellow pepper", "pepper strip"],
  poisson: ["salmon", "cod", "tuna", "hake", "sea bream", "pollock", "trout", "sardine", "mackerel", "monkfish", "sole", "sea bass", "haddock", "fish"],
};
const ING_EN: Record<string, string> = {
  poulet: "chicken", saumon: "salmon", thon: "tuna", cabillaud: "cod", crevette: "prawn", boeuf: "beef", "steak haché": "minced beef", porc: "pork",
  jambon: "ham", lardon: "bacon", chorizo: "chorizo", saucisse: "sausage", dinde: "turkey", oeuf: "egg", "pâtes": "pasta", riz: "rice",
  "pomme de terre": "potato", "patate douce": "sweet potato", courgette: "courgette", aubergine: "aubergine", tomate: "tomato", poivron: "pepper",
  carotte: "carrot", brocoli: "broccoli", "chou-fleur": "cauliflower", "épinard": "spinach", champignon: "mushroom", poireau: "leek",
  potiron: "pumpkin", butternut: "butternut squash", lentille: "lentil", "pois chiche": "chickpea", "haricot vert": "green bean",
  avocat: "avocado", fromage: "cheese", poisson: "fish", mozzarella: "mozzarella", "chèvre": "goat cheese", feta: "feta", parmesan: "parmesan",
  tofu: "tofu", quinoa: "quinoa", semoule: "couscous", chocolat: "chocolate", pomme: "apple", banane: "banana", citron: "lemon",
  fraise: "strawberry", poire: "pear", "noix de coco": "coconut", "crème": "cream", "lait de coco": "coconut milk", curry: "curry",
};
const INGREDIENTS = ["poulet", "saumon", "thon", "cabillaud", "crevette", "boeuf", "steak haché", "porc", "jambon", "lardon", "chorizo",
  "saucisse", "dinde", "oeuf", "pâtes", "riz", "pomme de terre", "patate douce", "courgette", "aubergine", "tomate", "poivron",
  "carotte", "brocoli", "chou-fleur", "épinard", "champignon", "poireau", "potiron", "butternut", "lentille", "pois chiche",
  "haricot vert", "avocat", "fromage", "poisson", "mozzarella", "chèvre", "feta", "parmesan", "tofu", "quinoa", "semoule", "chocolat",
  "pomme", "banane", "citron", "fraise", "poire", "noix de coco", "crème", "lait de coco", "curry"];
const words = (s: string) => catalogKey(s).split(" ");
// Pas les bouillons ni les concentrés (« bouillon de bœuf » n'est pas une recette au bœuf), ni la pâte brisée ou à pizza
// pour les pâtes, ni la pomme de terre pour la pomme
const contains = (r: CatalogRecipe & { tags: string }, ing: string) => {
  const family = FAMILIES[ing] ?? [ing];
  if (ENGLISH) {
    const fam = FAMILIES_EN[ing] ?? [ING_EN[ing] ?? ing];
    return (r.items as { name: string }[]).some(i => {
      const k = catalogKey(i.name), n = k.split(" ");
      // « chicken stock », « tomato paste » ne comptent pas, ni « coconut milk » pour la noix de coco
      if (/ (stock|paste|puree|concentrate|powder|flake)$/.test(k) || /^stock /.test(k)) return false;
      if (ing === "noix de coco" && k.includes("milk")) return false;
      return fam.some(f => words(f).every(x => n.includes(x)));
    });
  }
  return (r.items as { name: string }[]).some(i => {
    const k = catalogKey(i.name), n = k.split(" ");
    if (/^(bouillon|concentre|fond) /.test(k) || (/^pate /.test(k) && !/^pate complete/.test(k))) return false;
    if (ing === "pomme" && k.includes("pomme de terre")) return false;
    return family.some(f => words(f).every(x => n.includes(x)));
  });
};
const lists: [string, string[], (r: CatalogRecipe & { tags: string }) => boolean][] = [
  ...LISTS, ...INGREDIENTS.map(i => [i, [], (r: CatalogRecipe & { tags: string }) => contains(r, i)] as [string, string[], (r: CatalogRecipe & { tags: string }) => boolean]),
];
for (const [fq, falias, test] of lists) {
  // En anglais : la clé française, la recherche et les alias en anglais
  const key = pre + catalogKey(fq);
  const alias = ENGLISH ? LIST_EN[fq] ?? [ING_EN[fq] ?? fq] : falias;
  const q = ENGLISH ? alias[0] : fq;
  // Un plat porte déjà ce nom : sa recherche montre ce plat (à vérifier si c'est voulu)
  if (taken.has(key)) { console.log(`« ${q} » : déjà un plat`); continue; }
  // Les classiques d'abord, puis les variantes, mélangées de façon stable d'un lancement à l'autre (pas toujours les premiers plats écrits)
  const mix = (r: CatalogRecipe) => [...`${key}${r.title}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const found = all.filter(test)
    .sort((a, b) => Number(b.variant === CLASSIC) - Number(a.variant === CLASSIC) || mix(a) - mix(b)).slice(0, MAX);
  if (found.length < 3) continue;
  const aliases = [...new Set(alias.map(a => pre + catalogKey(a)))].filter(a => a !== key && !taken.has(a));
  for (const k of [key, ...aliases]) taken.add(k);
  // Dans une réserve, chaque recette est un plat à part entière : sans « Plus légère »
  rows.push({ key, query: q, aliases, kind: "list", recipes: found.map(r => without(r, ["tags", "variant", "change"])) });
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} problème(s) : rien n'est écrit.`);
  process.exit(1);
}

// Le SQL, en fichiers d'environ 400 Ko (l'éditeur de Supabase n'aime pas les très gros collages)
const out = join(ROOT, "sql");
const prefix = ENGLISH ? "catalogue-en-" : "catalogue-";
mkdirSync(out, { recursive: true });
// Seulement les fichiers de cette langue : le français et l'anglais se génèrent à part
for (const f of readdirSync(out)) if (f.startsWith(prefix) && (ENGLISH || !f.startsWith("catalogue-en-"))) rmSync(join(out, f));
const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`;
const statement = (r: Row) => {
  const json = JSON.stringify(r.recipes);
  if (json.includes("$r$")) throw new Error(r.key);
  return `insert into public.recipe_catalog (key, query, aliases, kind, recipes, source) values (${sqlText(r.key)}, ${sqlText(r.query)}, ` +
    `array[${r.aliases.map(sqlText).join(", ")}]::text[], '${r.kind}', $r$${json}$r$::jsonb, 'claude')\n` +
    `on conflict (key) do update set query = excluded.query, aliases = excluded.aliases, kind = excluded.kind, recipes = excluded.recipes, source = 'claude', updated_at = now();\n`;
};
const chunks: string[][] = [[]];
let size = 0;
for (const r of rows) {
  const s = statement(r);
  if (size + s.length > 400_000 && chunks[chunks.length - 1].length) { chunks.push([]); size = 0; }
  chunks[chunks.length - 1].push(s);
  size += s.length;
}
chunks.forEach((c, i) => {
  const name = `${prefix}${String(i + 1).padStart(2, "0")}.sql`;
  writeFileSync(join(out, name), `-- Catalogue d'Explorer${ENGLISH ? " en anglais" : ""}, partie ${i + 1} sur ${chunks.length} (généré par npm run catalogue, ne pas modifier à la main)\n` +
    `-- À lancer après la migration 20261030000000_catalogue_recettes.sql : SQL Editor > New query > coller > Run.\nbegin;\n${c.join("")}commit;\n`);
});
const dishes = rows.filter(r => r.kind === "dish").length;
console.log(`${dishes} plats (${all.length} recettes), ${rows.length - dishes} catégories et ingrédients, en ${chunks.length} fichier(s) dans ${out}`);
