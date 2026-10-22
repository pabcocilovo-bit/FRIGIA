// Scan, 2e partie : la liste d'ingrédients (vérifiée par le compte) devient 3 recettes, ou 2 « autres idées ».
// Avec le jeton d'une photo déjà comptée, rien n'est recompté. Sans jeton (ingrédients tapés à la main),
// la formule Gratuit compte un scan. « D'autres idées » (2 recettes de plus) est réservé à Frigia Plus.
import { adminClient, authUser, isPlus, preflight, type Req, type Res } from "./_shared.js";
import { askClaude, checkIdeasLimit, extractFirstJSON, checkRateLimit, checkScanToken, dishPhoto, prefLines, refundFreeScan, takeFreeScan, type Prefs } from "./_ai.js";

type Body = {
  ingredients?: { name?: unknown; qty?: unknown; finish?: unknown }[];
  /** Ce qu'il y a vraiment dans les placards (Ma cuisine), et les pastilles de « Dans tes placards ? » */
  pantry?: { name?: unknown; qty?: unknown }[]; /** Une ou plusieurs envies (« envie » : une seule, les anciennes versions de l'app) */
  envie?: string; envies?: unknown;
  /** Le menu : combien de recettes (3 par défaut), et combien de desserts parmi elles (le reste : des plats pour meal) */
  count?: number; desserts?: number;
  /** Frigia Plus : frigo vide, des plats avec les placards et une petite liste de courses */
  empty?: boolean; meal?: string; servings?: number;
  prefs?: Prefs; recentTitles?: string[]; avoid?: string[]; more?: boolean; token?: string;
  /** Frigia Plus : ceux du foyer qui mangent */
  eaters?: { name?: unknown; kid?: unknown; age?: unknown; allergies?: unknown; dislikes?: unknown }[];
};
type RawItem = { name?: unknown; plural?: unknown; qty?: unknown; unit?: unknown; have?: unknown };
type RawStep = { text?: unknown; timer?: { label?: unknown; min?: unknown } | null } | string;

/** Ingrédients et étapes lisibles d'une recette de l'IA, ou null s'il en manque (moins de 2 de chaque). */
function parse(r: RawRecipe | null | undefined) {
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
  if (missingFromTitle(str(r.title, 80), items.map(i => i.name)).length) return null;
  return { r, title: str(r.title, 80), items, steps };
}
type RawRecipe = {
  title?: unknown; intro?: unknown; minutes?: unknown; time?: unknown; calories?: unknown; kcal?: unknown; difficulty?: unknown; imageSearch?: unknown;
  veg?: unknown; oven?: unknown; cold?: unknown; kids?: unknown; missing?: unknown; origin?: unknown; ingredients?: (RawItem | string)[]; steps?: RawStep[];
};

const ENVIES: Record<string, string> = {
  rapide: "rapides : prêtes en 25 minutes au plus",
  healthy: "légères et équilibrées",
  proteine: "riches en protéines (viande, poisson, œufs, légumineuses)",
  gourmand: "généreuses et réconfortantes",
  enfants: "qui plaisent aux enfants : simples, douces, pas épicées",
  gaspi: "anti-gaspi : elles utilisent d'abord les ingrédients disponibles qui s'abîment vite, sans forcer ceux qui ne vont pas avec le plat",
};
const MEALS: Record<string, string> = {
  m: "le déjeuner de ce midi. Au moins une recette doit pouvoir se manger froide (à emporter)",
  s: "le dîner de ce soir",
  w: "plusieurs repas de la semaine. Des recettes qui se gardent bien. Classe-les dans l'ordre où les cuisiner : d'abord celle qui utilise les produits qui s'abîment le plus vite",
  d: "le dessert. UNIQUEMENT DU SUCRÉ (gâteau, crème, tarte, fruits, crêpes…), jamais de plat salé. Les ingrédients salés de la liste (viande, poisson, légumes, fromages forts) sont ignorés",
};
// Pour varier : une recette sur trois peut s'inspirer d'une cuisine tirée au sort (les deux autres restent du quotidien)
const STYLES = ["italienne", "espagnole", "grecque", "libanaise", "marocaine", "indienne", "thaïlandaise", "japonaise", "mexicaine",
  "provençale", "basque", "alsacienne", "bretonne", "lyonnaise", "américaine", "portugaise", "vietnamienne", "turque"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map(x => str(x, max)).filter(Boolean).slice(0, n) : []);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/s\b/g, "");
// Un nombre, ou un texte qui commence par un nombre ("20 min", "450 kcal")
const num = (v: unknown) => {
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
function salvage(text: string): RawRecipe[] {
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

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const admin = adminClient();
  const user = await authUser(req, admin);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const body = (req.body ?? {}) as Body;
  const plus = isPlus(user);
  if (body.more && !plus) return res.status(403).json({ error: "« D'autres idées » est dans Frigia Plus.", code: "plus" });
  const empty = body.empty === true;
  if (empty && !plus) return res.status(403).json({ error: "Les idées frigo vide sont dans Frigia Plus.", code: "plus" });

  const list = (Array.isArray(body.ingredients) ? body.ingredients : [])
    .map(i => ({ name: str(i?.name, 60), qty: str(i?.qty, 30), finish: i?.finish === true }))
    .filter(i => i.name)
    .slice(0, 40);
  if (list.length === 0 && !empty) return res.status(400).json({ error: "Aucun ingrédient" });
  const pantry = (Array.isArray(body.pantry) ? body.pantry : [])
    .map(i => ({ name: str(i?.name, 60), qty: str(i?.qty, 30) }))
    .filter(i => i.name)
    .slice(0, 60);
  const envies = [...new Set(Array.isArray(body.envies) ? body.envies : [body.envie])]
    .map(e => (typeof e === "string" && Object.hasOwn(ENVIES, e) ? ENVIES[e] : undefined)).filter((e): e is string => !!e);

  // Ingrédients tapés à la main (pas de photo comptée) : c'est un scan, compté dans la limite par heure
  // et, en Gratuit, dans les 15 scans
  const fromPhoto = checkScanToken(body.token, user.id);
  if (!(fromPhoto || body.more ? checkIdeasLimit(user.id) : await checkRateLimit(admin, user.id))) {
    return res.status(429).json({ error: "Limite atteinte. Réessaie dans une heure.", code: "rate" });
  }
  const counted = !plus && !fromPhoto;
  let scansLeft: number | null = null;
  if (counted) {
    scansLeft = await takeFreeScan(admin, user.id);
    if (scansLeft === null) return res.status(503).json({ error: "Service temporairement indisponible." });
    if (scansLeft < 0) return res.status(403).json({ error: "Tes scans gratuits sont utilisés.", code: "quota" });
  }
  const fail = async (status: number, error: string, code?: string) => {
    if (counted) await refundFreeScan(admin, user.id);
    return res.status(status).json({ error, ...(code ? { code } : {}) });
  };

  const count = body.more ? 2 : Math.min(3, Math.max(1, Math.round(Number(body.count) || 3)));
  // Le menu : des plats (midi, soir ou la semaine) et des desserts, chacun demandé à part, en même temps.
  // meal « d » (ancienne façon) : que des desserts.
  const meal = body.meal === "m" || body.meal === "w" || body.meal === "d" ? body.meal : "s";
  const desserts = meal === "d" ? count : meal === "w" ? 0 : Math.min(count, Math.max(0, Math.round(Number(body.desserts) || 0)));
  const dishes = count - desserts;
  const servings = Math.min(60, Math.max(0.5, Number(body.servings) || 2));
  const lines = prefLines(body.prefs);
  const finish = list.filter(i => i.finish).map(i => i.name);
  // Le foyer (Plus) : qui mange, les allergies de chacun (obligatoire), ce qu'ils n'aiment pas (à éviter)
  const eaters = (plus && Array.isArray(body.eaters) ? body.eaters : []).slice(0, 12).map(e => ({
    name: str(e?.name, 20) || "Quelqu'un", kid: e?.kid === true,
    age: typeof e?.age === "number" && e.age >= 1 && e.age <= 17 ? Math.round(e.age) : null,
    allergies: strs(e?.allergies, 10, 30), dislikes: strs(e?.dislikes, 10, 24),
  }));
  const kids = eaters.filter(e => e.kid);
  const dislikes = [...new Set(eaters.flatMap(e => e.dislikes))];
  const familyLines = eaters.length ? [
    `QUI MANGE : ${eaters.map(e => (e.kid ? `${e.name} (enfant${e.age ? `, ${e.age} ans` : ""})` : `${e.name} (adulte)`)).join(", ")}.`,
    ...eaters.filter(e => e.allergies.length).map(e => `ALLERGIE DE ${e.name.toUpperCase()} (OBLIGATOIRE) : aucune recette ne doit contenir ${e.allergies.join(", ")}, même en petite quantité.`),
    dislikes.length ? `N'AIMENT PAS (à éviter dans toutes les recettes) : ${eaters.filter(e => e.dislikes.length).map(e => `${e.name} : ${e.dislikes.join(", ")}`).join(" ; ")}.` : "",
    kids.length ? `Des enfants mangent : des recettes qui leur plaisent, pas trop épicées. "kids" : true pour une recette que les enfants adorent.` : "",
  ].filter(Boolean) : [];
  const avoid = [...new Set([...(body.avoid ?? []), ...(body.recentTitles ?? [])].filter(t => typeof t === "string").map(t => t.slice(0, 80)))].slice(0, 40);
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  const promptFor = (meal: string, count: number) => [
    empty && !list.length
      ? "Le frigo est vide : rien de frais à la maison."
      : `Ingrédients disponibles : ${list.map(i => (i.qty ? `${i.name} (${i.qty})` : i.name)).join(", ")}.`,
    finish.length ? `À FINIR EN PRIORITÉ (ils vont se perdre) : ${finish.join(", ")}. Chaque recette en utilise au moins un, s'il va avec le plat.` : "",
    pantry.length
      ? `Dans les placards : ${pantry.map(i => (i.qty ? `${i.name} (${i.qty})` : i.name)).join(", ")}. Ils comptent comme disponibles.`
      : empty ? "Les placards sont vides aussi." : "",
    "Sel, poivre et eau sont toujours là. Rien d'autre n'est disponible : tout ingrédient absent des listes (même huile, beurre, ail, épices) est à acheter, avec \"have\" : false.",
    `Propose EXACTEMENT ${count} recette${count > 1 ? "s" : ""} pour ${MEALS[meal]}.`,
    meal === "d" ? "" : "Des plats salés (entrée ou plat principal) : jamais de dessert, de gâteau ni de recette sucrée. Les produits sucrés de la liste (biscuits, chocolat, barres, confiture…) sont ignorés. S'il ne reste presque rien de salé, fais des plats simples avec ce qui reste et les 1 ou 2 achats permis.",
    envies.length ? `Envie : des recettes ${envies.join(" ; et ")}${envies.length > 1 ? " (tout à la fois)" : ""}.` : "",
    `Quantités pour ${String(servings).replace(".", ",")} portion${servings > 1 ? "s" : ""} (un enfant compte pour une demi-portion).`,
    empty
      ? `Des plats simples et sans gâchis${pantry.length ? ", faits surtout avec les placards" : ""}. Chaque recette demande au plus ${pantry.length ? 4 : 5} ingrédients à acheter, faciles à trouver au supermarché. Les 3 recettes partagent le plus possible les mêmes achats.`
      : "Utilise surtout ce qui est disponible. Une recette peut demander 1 ou 2 ingrédients à acheter, pas plus.",
    "Des recettes qui existent vraiment et qu'on a envie de manger : n'associe que des ingrédients qui vont bien ensemble. Mieux vaut laisser un ingrédient de côté qu'inventer un mélange étrange.",
    "N'UTILISE PAS TOUT LE FRIGO : chaque recette prend seulement 3 à 6 ingrédients disponibles qui vont ensemble, pas toute la liste. Les 3 recettes se partagent le frigo : un ingrédient peut n'apparaître dans aucune. Ne mélange jamais sucré et salé (pas de pain au chocolat, viennoiserie, biscuit, yaourt sucré, confiture ou dessert dans un plat salé).",
    "UNE SEULE BASE PAR PLAT : jamais deux féculents principaux ensemble (pas de pâtes avec des gnocchis, pas de riz avec des pommes de terre, pas de pâtes avec du pain). Un produit tout prêt (gnocchis à la sauce, pâtes farcies, raviolis, plat cuisiné) est la base du plat à lui seul : on le complète avec des légumes, une protéine ou une garniture, jamais avec un autre produit tout prêt ni un autre féculent.",
    meal === "d" ? `VARIÉTÉ : ${count > 1 ? `${count} desserts de types différents (pas deux gâteaux, pas deux crèmes), ` : ""}des desserts qu'on connaît et qu'on a envie de manger.` : count < 2 ? "" : `VARIÉTÉ : ${count} plats de types différents (pas deux plats de pâtes, pas deux poêlées, pas deux omelettes), avec des bases différentes (pâtes, riz, pommes de terre, pain, légumineuses, œufs…). ${count > 2 ? "Au moins 2 recettes" : "Au moins 1 recette"} sont des plats du quotidien qu'on connaît en France. La dernière peut venir d'ailleurs : aujourd'hui, inspire-toi de la cuisine ${style} si les ingrédients s'y prêtent.`,
    lines.length ? `PRÉFÉRENCES (à respecter) :\n${lines.join("\n")}` : "",
    familyLines.length ? `LE FOYER :\n${familyLines.join("\n")}` : "",
    avoid.length ? `DÉJÀ PROPOSÉES RÉCEMMENT, À NE PAS REPROPOSER, ni une variante proche (le même plat avec les mêmes ingrédients principaux sous un autre nom) : ${avoid.join(" ; ")}.` : "",
    `Pour chaque recette :
- "title" : nom court et appétissant, en français. Il décrit exactement le plat : tout ce qu'il nomme (base comme wrap, pâtes, riz, ou ingrédient) est dans "ingredients". Vérifie-le avant de répondre : un titre « aux petits pois » demande des petits pois dans "ingredients". Pas de « wrap » sans galette, pas de « gratin » sans four.
- "intro" : 1 ou 2 phrases simples qui donnent envie, au tutoiement. Pour un plat peu connu en France, dis d'abord en quelques mots ce que c'est (« La shakshuka, ce sont des œufs pochés dans une sauce tomate épicée. »).
- "origin" : "" pour un plat courant en France. Pour une spécialité d'un pays ou d'une région, 2 à 4 mots : "Spécialité libanaise", "Plat indien", "Recette basque".
- "minutes" : durée totale. "calories" : kcal par portion. "difficulty" : "Facile", "Moyen" ou "Difficile".
- "imageSearch" : le plat EN ANGLAIS, 2 à 4 mots : l'ingrédient principal puis le type de plat ("mushroom pasta", "tomato omelette", "lentil soup", "chicken curry"). Le dernier mot est toujours le type de plat.
- "veg" : true si sans viande ni poisson. "oven" : true si elle passe au four. "cold" : true si elle se mange froide.${kids.length ? ` "kids" : true si les enfants l'adorent.` : ""}
- "ingredients" : chaque ingrédient avec "name" (minuscules, singulier), "plural" (minuscules, pluriel), "qty" (nombre, ou null pour « un peu »), "unit" ("g", "ml", "cl", "c. à s.", "c. à c.", "gousse", "feuilles", "tranches", ou "" pour un nombre de pièces), "have" (true si disponible). Les pâtes, gnocchis, riz, semoule, lentilles et autres produits en paquet se comptent en "g", jamais en pièces. "name" est un vrai nom d'ingrédient (« rigatoni à la truffe », pas « rigatoni truffe »).
- "missing" : les ingrédients à acheter avec leur article, en minuscules ("le parmesan et le basilic"), ou "" s'il ne manque rien.
- "steps" : 3 à 7 étapes au tutoiement, phrases courtes, avec quantités, températures et durées. Une étape qui attend (four, cuisson, repos) a un "timer" : {"label":"Four","min":20}, sinon null.`,
    `JSON uniquement : {"recipes":[{"title":"Penne aux légumes rôtis","intro":"Les légumes rôtissent pendant que les pâtes cuisent.","minutes":25,"calories":540,"difficulty":"Facile","imageSearch":"vegetable pasta","origin":"","veg":true,"oven":true,"cold":false,"ingredients":[{"name":"penne","plural":"penne","qty":200,"unit":"g","have":true},{"name":"courgette","plural":"courgettes","qty":1,"unit":"","have":true},{"name":"parmesan","plural":"parmesan","qty":30,"unit":"g","have":false}],"missing":"le parmesan","steps":[{"text":"Préchauffe le four à 220 °C. Coupe la courgette en gros morceaux.","timer":null},{"text":"Enfourne les légumes avec un filet d'huile.","timer":{"label":"Four","min":20}}]}]}`,
  ].filter(Boolean).join("\n");

  // Une recette sans ses ingrédients ou ses étapes (réponse de l'IA incomplète) n'est jamais montrée :
  // on redemande une fois les recettes qui manquent.
  const ask = async (meal: string, count: number) => {
    const answer = await askClaude<{ recipes?: RawRecipe[] }>([{ type: "text", text: promptFor(meal, count) }], 6000);
    if (!answer.ok) return null;
    const found = Array.isArray(answer.json?.recipes) ? answer.json.recipes : salvage(answer.text);
    const valid = found.map(parse).filter(r => r !== null);
    // Visible dans les logs Vercel : ce que l'IA a répondu quand il manque des recettes
    if (valid.length < count) console.warn(`recipes ${meal}: ${valid.length}/${count} valides`, answer.text.slice(0, 1500));
    return valid;
  };
  const t0 = Date.now();
  const gen = async (meal: string, count: number) => {
    if (!count) return [];
    const first = await ask(meal, count);
    if (!first) return null;
    let raw = first.slice(0, count);
    // Une 2e demande seulement s'il reste le temps (la fonction s'arrête à 60 s)
    if (raw.length < count && Date.now() - t0 < 25000) {
      const again = (await ask(meal, count)) ?? [];
      raw = [...raw, ...again.filter(r => !raw.some(o => norm(o.title) === norm(r.title)))].slice(0, count);
    }
    return raw;
  };
  const [mains, sweets] = await Promise.all([gen(meal === "d" ? "s" : meal, dishes), gen("d", desserts)]);
  if (!mains && !sweets) return fail(502, "Service IA temporairement indisponible.");
  const raw = [...(mains ?? []).map(r => ({ ...r, dessert: false })), ...(sweets ?? []).map(r => ({ ...r, dessert: true }))];
  if (raw.length === 0) {
    return fail(422, !dishes
      ? "Pas de dessert trouvé avec ces ingrédients. Ajoute-en un ou deux, ou choisis des plats."
      : "Pas de plat trouvé avec ces ingrédients. Ajoute-en un ou deux, ou choisis des desserts.", "none");
  }

  const recipes = await Promise.all(raw.map(async ({ r, items, steps, dessert }) => {
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
      // « Les enfants adorent » seulement avec des enfants à table ; « Sans champignons » vérifié sur les ingrédients
      kids: kids.length > 0 && r.kids === true,
      without: dislikes.filter(d => !items.some(i => norm(i.name).includes(norm(d)) || norm(d).includes(norm(i.name)))),
      items,
      steps,
      ...(dessert ? { dessert: true } : {}),
    };
  }));

  res.json({ recipes, scansLeft });
}
