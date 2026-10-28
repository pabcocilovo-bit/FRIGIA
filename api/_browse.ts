// Explorer à la Netflix (demandé par Hugo le 26 octobre) : la page d'accueil d'Explorer, en rangées de recettes du catalogue.
// La recette du jour, le Top 10 (les plats les plus cherchés), « Avec ce que tu as » (Ma cuisine), les envies et des thèmes.
// Jamais l'IA : tout vient de recipe_catalog. L'ordre des rangées et les recettes changent chaque jour.
// Un plat (« Lasagnes ») part en carte légère : le toucher lance la recherche (la classique et ses variantes, du catalogue).
// Une recette d'une réserve (« Vite fait ») part entière : elle s'ouvre tout de suite.
// Appelé par api/recipes.ts ({ browse: true }) : Vercel Hobby limite le nombre de fonctions (12).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Req, Res } from "./_shared.js";
import { dishPhoto, type Prefs } from "./_ai.js";
import { type CatalogRecipe, catalogKey, constraintsOf, fits, parts } from "./_catalog.js";
import { str, strs } from "./_recipe.js";
import { canGenerate, photograph } from "./_images.js";

/** Un plat : la carte de sa recette classique */
/** recipe : le titre de sa recette classique (la photo du plat est la sienne) */
type DishCard = { q: string; title: string; recipe: string; minutes: number; difficulty: string; imageUrl?: string; imageSearch: string; veg: boolean };
type Row = { id: string; title: string; top?: boolean; q?: string; dishes?: DishCard[]; recipes?: CatalogRecipe[] };
type DishRow = { key: string; query: string; hits: number; title: string | null; minutes: number | null; difficulty: string | null;
  imageUrl: string | null; imageSearch: string | null; veg: boolean | null };
type PoolRow = { key: string; query: string; recipes: CatalogRecipe[] };

// Les réserves (supabase/catalogue, LISTS) : la clé, le titre de la rangée
const POOLS: [string, string][] = [
  ["recettes rapides", "Vite fait, bien fait"],
  ["recettes healthy", "Healthy et gourmand"],
  ["recettes petit budget", "Petit budget"],
  ["plats en famille qui plaisent aux enfants", "Les enfants adorent"],
  ["végétarien", "100 % végé"],
  ["entrées", "Pour commencer"],
];
// Les placards de tout le monde : une rangée chacun, tous les jours (Hugo, 26 octobre)
const STAPLES: [string, string][] = [
  ["pâtes", "Avec des pâtes"], ["riz", "Avec du riz"], ["pomme de terre", "Avec des pommes de terre"], ["oeuf", "Avec des œufs"],
];
// « Envie de … ? » : deux par jour
const ENVIES: [string, string][] = [
  ["poulet", "poulet"], ["saumon", "saumon"], ["pâtes", "pâtes"], ["chocolat", "chocolat"], ["courgette", "courgettes"],
  ["pomme de terre", "pommes de terre"], ["oeuf", "œufs"], ["crevette", "crevettes"], ["avocat", "avocat"], ["fromage", "fromage"],
  ["citron", "citron"], ["champignon", "champignons"], ["riz", "riz"], ["tomate", "tomates"], ["boeuf", "bœuf"], ["lentille", "lentilles"],
  ["curry", "curry"], ["fraise", "fraises"], ["banane", "banane"], ["poisson", "poisson"],
];
// Les thèmes : des plats du catalogue (supabase/catalogue/plats-NN.json), par leur nom
const THEMES: [string, string, string[]][] = [
  ["classiques", "Les grands classiques", ["Gratin dauphinois", "Blanquette de veau", "Bœuf bourguignon", "Pot-au-feu", "Hachis parmentier",
    "Quiche lorraine", "Coq au vin", "Poulet rôti", "Croque-monsieur", "Steak frites", "Ratatouille", "Poulet basquaise", "Endives au jambon", "Soupe à l'oignon"]],
  ["italie", "Voyage en Italie", ["Lasagnes", "Pâtes carbonara", "Spaghetti bolognaise", "Risotto aux champignons", "Pizza", "Tiramisu", "Gnocchis",
    "Osso buco", "Cannellonis", "Aubergines à la parmesane", "Arancini", "Panna cotta", "Saltimbocca", "Spaghetti alle vongole", "Pâtes au pesto"]],
  ["asie", "Saveurs d'Asie", ["Pad thaï", "Bo bun", "Ramen", "Poke bowl", "Curry vert thaï", "Riz cantonais", "Nouilles sautées", "Poulet teriyaki",
    "Porc au caramel", "Bibimbap", "Gyozas", "Phở", "Poulet satay", "Bulgogi", "Nems", "Makis"]],
  ["epices", "Épices d'ailleurs", ["Curry de poulet", "Butter chicken", "Poulet tikka masala", "Dal de lentilles", "Biryani", "Chana masala", "Couscous",
    "Tajine de poulet", "Shakshuka", "Falafels", "Mafé", "Poulet yassa", "Colombo de poulet", "Rougail saucisse", "Naans"]],
  ["street", "Street food", ["Burger maison", "Tacos", "Fajitas", "Burritos", "Quesadillas", "Nachos", "Hot dog", "Bagels", "Kebab maison", "Shawarma",
    "Empanadas", "Fish and chips", "Club sandwich", "Poutine", "Wrap au poulet"]],
  ["regions", "Le tour de France", ["Tartiflette", "Raclette", "Fondue savoyarde", "Cassoulet", "Choucroute", "Bouillabaisse", "Tarte flambée",
    "Pissaladière", "Soupe au pistou", "Daube provençale", "Piperade", "Potée auvergnate", "Aligot", "Far breton", "Gâteau basque", "Carbonade flamande"]],
  ["mer", "Poissons et fruits de mer", ["Saumon au four", "Moules marinières", "Dos de cabillaud", "Poisson en papillote", "Crevettes à l'ail",
    "Sole meunière", "Saint-Jacques poêlées", "Dorade au four", "Truite aux amandes", "Tartare de saumon", "Curry de poisson", "Brandade de morue", "Paella"]],
  ["soupes", "Soupes et veloutés", ["Soupe de légumes", "Velouté de potiron", "Velouté de carottes", "Soupe à l'oignon", "Minestrone", "Gaspacho",
    "Velouté de courgettes", "Potage poireaux pommes de terre", "Soupe miso", "Velouté de brocoli", "Soupe de pois cassés", "Velouté de champignons",
    "Velouté de tomates", "Soupe thaï"]],
  ["salades", "Salades fraîcheur", ["Salade niçoise", "Salade César", "Salade caprese", "Salade grecque", "Taboulé", "Salade de chèvre chaud",
    "Salade de pâtes", "Salade de lentilles", "Salade de quinoa", "Buddha bowl", "Coleslaw", "Salade de riz", "Carottes râpées"]],
  ["brunch", "Brunch du dimanche", ["Pancakes", "Pain perdu", "Œufs Bénédicte", "Avocado toast", "Granola", "Porridge", "Smoothie", "Œufs brouillés",
    "Frittata", "Gaufres", "Bowl cake", "Chia pudding", "Œufs cocotte", "Welsh", "Brioche"]],
  ["gouter", "L'heure du goûter", ["Crêpes", "Gâteau au yaourt", "Cookies", "Brownie", "Muffins", "Madeleines", "Quatre-quarts", "Gâteau marbré",
    "Banana bread", "Cake au citron", "Sablés", "Financiers", "Beignets", "Churros", "Donuts", "Cupcakes"]],
  ["desserts", "Desserts gourmands", ["Mousse au chocolat", "Tarte aux pommes", "Tarte au citron", "Crème brûlée", "Tarte tatin", "Gâteau au chocolat",
    "Profiteroles", "Île flottante", "Cheesecake", "Crumble", "Clafoutis", "Riz au lait", "Flan pâtissier", "Charlotte aux fraises", "Pavlova", "Éclairs au chocolat"]],
  ["recevoir", "Pour recevoir", ["Magret de canard", "Gigot d'agneau", "Filet mignon de porc", "Saint-Jacques poêlées", "Lotte à l'armoricaine",
    "Navarin d'agneau", "Veau Marengo", "Bœuf Stroganoff", "Tartare de bœuf", "Carpaccio de bœuf", "Blinis", "Rôti de bœuf", "Parmentier de canard", "Bûche de Noël"]],
  ["mijotes", "Petits plats mijotés", ["Chili con carne", "Navarin d'agneau", "Goulash", "Tajine d'agneau", "Petit salé aux lentilles",
    "Lapin à la moutarde", "Poulet à la crème", "Paupiettes de veau", "Daube provençale", "Bœuf bourguignon", "Pot-au-feu", "Jambalaya", "Veau Marengo"]],
  ["enfance", "Comme quand on était petit", ["Coquillettes au jambon", "Steak haché purée", "Saucisses purée", "Cordon bleu", "Poulet pané",
    "Hachis parmentier", "Gratin de pâtes", "Pâtes à la sauce tomate", "Tomates farcies", "Purée maison", "Œufs à la coque", "Galette complète", "Riz au lait"]],
  ["accompagnements", "Les accompagnements", ["Frites maison", "Pommes de terre sautées", "Purée maison", "Gratin dauphinois", "Röstis",
    "Patates douces rôties", "Légumes rôtis", "Poêlée de légumes", "Riz pilaf", "Haricots verts à l'ail", "Petits pois carottes", "Épinards à la crème",
    "Pommes de terre au four", "Aligot"]],
  ["apero", "Pour l'apéro", ["Guacamole", "Houmous", "Tzatziki", "Accras de morue", "Gougères", "Samoussas", "Bruschetta", "Focaccia",
    "Rillettes de thon", "Blinis", "Cake salé", "Muffins salés", "Feuilletés à la saucisse", "Arancini", "Rouleaux de printemps"]],
];
// Le Top 10 tant que les recherches ne suffisent pas : les plats préférés des Français
const POPULAR = ["Lasagnes", "Pâtes carbonara", "Tartiflette", "Hachis parmentier", "Blanquette de veau", "Bœuf bourguignon", "Gratin dauphinois",
  "Poulet rôti", "Couscous", "Crêpes", "Raclette", "Quiche lorraine", "Spaghetti bolognaise", "Mousse au chocolat", "Burger maison"];

// Ce qu'une allergie ou un régime enlève, en plus du mot lui-même (une recette d'une réserve s'ouvre telle quelle)
const ALSO: Record<string, string[]> = {
  arachide: ["cacahuete", "cacahouete"],
  "fruit a coque": ["noix", "noisette", "amande", "pistache", "cajou", "pecan", "praline"],
  lait: ["beurre", "creme", "fromage", "yaourt", "lait"], lactose: ["beurre", "creme", "fromage", "yaourt", "lait", "mozzarella", "parmesan"],
  gluten: ["farine", "pate", "pain", "semoule", "chapelure", "biscuit", "brioche", "nouille", "boulgour", "couscous", "feuille de brick", "pate feuillete"],
  oeuf: ["oeuf", "jaune", "blanc d oeuf", "mayonnaise"],
  poisson: ["saumon", "thon", "cabillaud", "colin", "sardine", "anchois", "truite", "dorade", "morue", "lotte", "sole", "poisson"],
  crustace: ["crevette", "homard", "langoustine", "crabe", "gambas"],
  "fruit de mer": ["crevette", "moule", "saint jacque", "calamar", "huitre", "crabe"],
  soja: ["soja", "tofu", "edamame", "miso"],
  sesame: ["sesame", "tahini"],
};

const DAY_MS = 24 * 3600 * 1000;
/** Le jour à Paris (à peu près) : tout change à minuit */
const today = () => Math.floor((Date.now() + 3600 * 1000) / DAY_MS);

/** Un tirage au sort qui donne le même ordre toute la journée */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  const rnd = seeded(seed);
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Une recette d'une réserve : elle s'ouvre telle quelle, donc elle doit déjà convenir (végé, sans four, allergies) */
function safe(r: CatalogRecipe, constraints: string): boolean {
  if (!constraints) return true;
  const names = (Array.isArray(r.items) ? r.items as { name?: unknown }[] : []).map(i => catalogKey(String(i?.name ?? ""))).join(" | ");
  return constraints.split("+").every(c => {
    if (c === "vegetarien" || c === "pescetarien" || c === "sans four") return fits(r, c);
    if (c === "vegan") return false;
    const word = c.replace(/^allergie /, "").replace(/^sans /, "");
    return ![word, ...(ALSO[word] ?? [])].some(w => names.includes(catalogKey(w)));
  });
}

const dishCard = (d: DishRow): DishCard | null => (d.title ? {
  q: d.query, title: d.query, recipe: d.title, minutes: Number(d.minutes) || 0, difficulty: d.difficulty ?? "",
  ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}), imageSearch: d.imageSearch ?? d.title, veg: d.veg === true,
} : null);

export async function browse(req: Req, res: Res, admin: SupabaseClient) {
  const body = (req.body ?? {}) as { prefs?: Prefs; eaters?: { allergies?: unknown }[]; ingredients?: unknown };
  const eaters = (Array.isArray(body.eaters) ? body.eaters : []).slice(0, 12);
  const constraints = constraintsOf(body.prefs, eaters.flatMap(e => strs(e?.allergies, 10, 30)));
  // Ma cuisine, le plus récent d'abord : « Avec ce que tu as »
  const kitchen = strs(body.ingredients, 8, 60).map(n => ({ name: str(n, 60), key: catalogKey(n) })).filter(k => k.key.length > 1);
  const day = today();

  const kitchenKeys = kitchen.flatMap(k => [k.key, ...parts(k.key)]);
  const poolKeys = [...new Set([...POOLS.map(p => catalogKey(p[0])), ...STAPLES.map(e => catalogKey(e[0])), ...ENVIES.map(e => catalogKey(e[0])), ...kitchenKeys])];
  const [dishRes, poolRes] = await Promise.all([
    admin.from("recipe_catalog")
      .select("key, query, hits, title:recipes->0->>title, minutes:recipes->0->minutes, difficulty:recipes->0->>difficulty, imageUrl:recipes->0->>imageUrl, imageSearch:recipes->0->>imageSearch, veg:recipes->0->veg")
      // Pas la réserve du scan (clés « frigo … », api/_fridge.ts) : Explorer garde ses plats
      .eq("kind", "dish").not("key", "like", "frigo %").limit(3000),
    // Les clés n'ont que des lettres, des chiffres et des espaces (catalogKey) : rien à échapper
    admin.from("recipe_catalog").select("key, query, recipes").eq("kind", "list").or(poolKeys.map(k => `key.eq."${k}"`).join(",")),
  ]);
  if (dishRes.error || poolRes.error) {
    console.error("browse:", dishRes.error?.message ?? poolRes.error?.message);
    return res.status(502).json({ error: "Explorer ne répond pas. Réessaie." });
  }
  const dishes = new Map((dishRes.data as unknown as DishRow[]).map(d => [d.key, d]));
  const pools = new Map((poolRes.data as PoolRow[]).map(p => [p.key, p]));
  const card = (name: string) => { const d = dishes.get(catalogKey(name)); return d ? dishCard(d) : null; };

  const poolRow = (id: string, title: string, key: string): Row | null => {
    const pool = pools.get(key);
    if (!pool) return null;
    const recipes = shuffle(pool.recipes.filter(r => safe(r, constraints)), day + hash(id)).slice(0, 10);
    return recipes.length >= 4 ? { id, title, q: pool.query, recipes } : null;
  };

  // Le Top 10 : les plats les plus cherchés, complétés par les préférés des Français
  const searched = [...dishes.values()].filter(d => d.hits > 0).sort((a, b) => b.hits - a.hits).map(d => d.key);
  const topKeys = [...new Set([...searched, ...POPULAR.map(catalogKey)])].slice(0, 10);
  const topCards = topKeys.map(k => dishes.get(k)).map(d => (d ? dishCard(d) : null)).filter(c => !!c);
  // Toujours 10 : complété par les grands classiques si un plat manque
  for (const name of THEMES[0][2]) if (topCards.length < 10 && !topCards.some(c => catalogKey(c.q) === catalogKey(name))) { const c = card(name); if (c) topCards.push(c); }
  const top: Row = { id: "top", title: "Top 10 du moment", top: true, dishes: topCards.slice(0, 10) };

  // La recette du jour : un plat des thèmes, de préférence avec sa photo
  const themed = [...new Set(THEMES.flatMap(t => t[2]))].map(card).filter(c => !!c);
  const withPhoto = themed.filter(c => c.imageUrl && !topKeys.includes(catalogKey(c.q)));
  const heroPool = withPhoto.length >= 5 ? withPhoto : themed;
  const hero = heroPool.length ? heroPool[Math.floor(seeded(day)() * heroPool.length)] : null;

  // Ma cuisine : une seule rangée « Avec ce que tu as », les recettes des réserves de ses ingrédients mêlées
  // (la réserve du nom, « pâtes », ou d'un mot du nom, « filet de poulet » : poulet). Hugo, 26 octobre : pas de nom d'ingrédient dans le titre.
  const used = new Set<string>();
  const lists: CatalogRecipe[][] = [];
  for (const k of kitchen) {
    if (lists.length >= 4) break;
    const key = [k.key, ...parts(k.key)].find(x => pools.has(x) && !used.has(x) && !POOLS.some(p => catalogKey(p[0]) === x));
    if (!key) continue;
    const found = shuffle(pools.get(key)!.recipes.filter(r => safe(r, constraints)), day + hash(key));
    if (found.length) { used.add(key); lists.push(found); }
  }
  const seenTitles = new Set<string>();
  const mixed: CatalogRecipe[] = [];
  for (let i = 0; mixed.length < 12 && lists.some(l => i < l.length); i++) {
    for (const l of lists) if (l[i] && mixed.length < 12 && !seenTitles.has(l[i].title)) { seenTitles.add(l[i].title); mixed.push(l[i]); }
  }
  const mine: Row[] = mixed.length >= 4 ? [{ id: "ing-cuisine", title: "Avec ce que tu as", recipes: mixed }] : [];
  const staples = STAPLES.map(([k, title]) => poolRow(`base-${catalogKey(k)}`, title, catalogKey(k))).filter((r): r is Row => !!r);
  const envies = shuffle(ENVIES.filter(e => !STAPLES.some(b => b[0] === e[0])), day + 11).slice(0, 2)
    .map(([k, label]) => poolRow(`envie-${catalogKey(k)}`, `Envie de ${label} ?`, catalogKey(k)));
  const themes: Row[] = THEMES.map(([id, title, names]) => ({
    id, title, dishes: shuffle(names.map(card).filter(c => !!c), day + hash(id)).slice(0, 12),
  })).filter(r => r.dishes.length >= 4);
  const rest = shuffle([...POOLS.map(([k, title]) => poolRow(`liste-${catalogKey(k)}`, title, catalogKey(k))), ...envies, ...themes]
    .filter((r): r is Row => !!r), day + 3);
  // Les placards, une rangée sur trois parmi les premières
  staples.forEach((r, i) => rest.splice(i * 3, 0, r));
  const rows = [top, ...mine, ...rest].filter(r => (r.dishes ?? r.recipes ?? []).length);

  // Les photos générées par l'IA (api/_images.ts) si FAL_KEY est là, après la réponse ; sinon Pexels, tout de suite
  if (canGenerate()) {
    const first = rows.slice(0, 6);
    photograph(admin, [
      ...[hero, ...first.flatMap(r => r.dishes ?? [])].filter((c): c is DishCard => !!c).map(c => ({ title: c.recipe, imageSearch: c.imageSearch, imageUrl: c.imageUrl })),
      ...first.flatMap(r => r.recipes ?? []),
    ], 8);
  } else await fillPhotos(admin, hero, rows.slice(0, 5));
  res.json({ day, hero, rows });
}

/** Les photos qui manquent sur les premières rangées : trouvées une fois (Pexels), puis gardées dans le catalogue.
 *  12 au plus par visite : le reste se remplit au fil des jours (et la carte a une photo de secours en attendant). */
async function fillPhotos(admin: SupabaseClient, hero: DishCard | null, rows: Row[]) {
  const needDish = [hero, ...rows.flatMap(r => r.dishes ?? [])].filter((c): c is DishCard => !!c && !c.imageUrl);
  const needPool = rows.flatMap(r => (r.recipes ?? []).filter(x => !x.imageUrl).map(x => ({ row: r, recipe: x })));
  const dishTodo = [...new Map(needDish.map(c => [catalogKey(c.q), c])).values()].slice(0, 8);
  const poolTodo = needPool.slice(0, 12 - dishTodo.length);
  if (!dishTodo.length && !poolTodo.length) return;
  const [dishUrls, poolUrls] = await Promise.all([
    Promise.all(dishTodo.map(c => dishPhoto(c.imageSearch))),
    Promise.all(poolTodo.map(x => dishPhoto(x.recipe.imageSearch))),
  ]);
  const tasks: PromiseLike<unknown>[] = [];
  // Un plat : la photo de sa classique (recipes[0]), sur toutes ses cartes du jour
  const byKey = new Map<string, string>();
  dishTodo.forEach((c, i) => { if (dishUrls[i]) byKey.set(catalogKey(c.q), dishUrls[i]!); });
  for (const c of needDish) { const url = byKey.get(catalogKey(c.q)); if (url) c.imageUrl = url; }
  if (byKey.size) {
    const keys = [...byKey.keys()];
    tasks.push(admin.from("recipe_catalog").select("key, recipes").or(keys.map(k => `key.eq."${k}"`).join(",")).then(({ data }) =>
      Promise.all((data as { key: string; recipes: CatalogRecipe[] }[] ?? []).map(row => {
        const recipes = row.recipes.map((r, i) => (i === 0 && !r.imageUrl ? { ...r, imageUrl: byKey.get(row.key) } : r));
        return admin.from("recipe_catalog").update({ recipes, updated_at: new Date().toISOString() }).eq("key", row.key);
      }))));
  }
  // Une réserve : la photo de la recette, gardée dans la réserve
  const byPool = new Map<string, Map<string, string>>();
  poolTodo.forEach((x, i) => {
    const url = poolUrls[i];
    if (!url || !x.row.q) return;
    x.recipe.imageUrl = url;
    const key = catalogKey(x.row.q);
    byPool.set(key, (byPool.get(key) ?? new Map()).set(x.recipe.title, url));
  });
  for (const [key, found] of byPool) {
    tasks.push(admin.from("recipe_catalog").select("recipes").eq("key", key).maybeSingle().then(({ data }) => {
      const list = (data?.recipes ?? []) as CatalogRecipe[];
      if (!list.length) return null;
      const recipes = list.map(r => (!r.imageUrl && found.has(r.title) ? { ...r, imageUrl: found.get(r.title) } : r));
      return admin.from("recipe_catalog").update({ recipes, updated_at: new Date().toISOString() }).eq("key", key);
    }));
  }
  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === "rejected") console.error("browse photos:", r.reason);
}
