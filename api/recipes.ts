// Scan, 2e partie : la liste d'ingrédients (vérifiée par le compte) devient 3 recettes, ou 2 « autres idées ».
// Avec le jeton d'une photo déjà comptée, rien n'est recompté. Sans jeton (ingrédients tapés à la main),
// la formule Gratuit compte un scan. « D'autres idées » (2 recettes de plus) est réservé à Frigia Plus.
import { adminClient, authUser, isPlus, preflight, type Req, type Res } from "./_shared.js";
import { askClaude, checkIdeasLimit, checkRateLimit, checkScanToken, dishPhoto, prefLines, refundFreeScan, takeFreeScan, type Prefs } from "./_ai.js";

type Body = {
  ingredients?: { name?: unknown; qty?: unknown; finish?: unknown }[];
  pantry?: boolean; envie?: string;
  /** Frigia Plus : frigo vide, des plats avec le placard et une petite liste de courses */
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
  return { r, title: str(r.title, 80), items, steps };
}
type RawRecipe = {
  title?: unknown; intro?: unknown; minutes?: unknown; calories?: unknown; difficulty?: unknown; imageSearch?: unknown;
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
};
// Pour varier : une recette sur trois peut s'inspirer d'une cuisine tirée au sort (les deux autres restent du quotidien)
const STYLES = ["italienne", "espagnole", "grecque", "libanaise", "marocaine", "indienne", "thaïlandaise", "japonaise", "mexicaine",
  "provençale", "basque", "alsacienne", "bretonne", "lyonnaise", "américaine", "portugaise", "vietnamienne", "turque"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map(x => str(x, max)).filter(Boolean).slice(0, n) : []);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/s\b/g, "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

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
  const fail = async (status: number, error: string) => {
    if (counted) await refundFreeScan(admin, user.id);
    return res.status(status).json({ error });
  };

  const count = body.more ? 2 : 3;
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
  const prompt = [
    empty && !list.length
      ? "Le frigo est vide : rien de frais à la maison."
      : `Ingrédients disponibles : ${list.map(i => (i.qty ? `${i.name} (${i.qty})` : i.name)).join(", ")}.`,
    finish.length ? `À FINIR EN PRIORITÉ (ils vont se perdre) : ${finish.join(", ")}. Chaque recette en utilise au moins un, s'il va avec le plat.` : "",
    body.pantry || empty
      ? "Le placard a aussi : pâtes, riz, huile, ail, épices, sel, poivre, farine, sucre. Ils comptent comme disponibles."
      : "Seuls sel, poivre et eau sont disponibles en plus de la liste.",
    `Propose EXACTEMENT ${count} recettes pour ${MEALS[body.meal ?? ""] ?? MEALS.s}.`,
    ENVIES[body.envie ?? ""] ? `Envie : des recettes ${ENVIES[body.envie!]}.` : "",
    `Quantités pour ${String(servings).replace(".", ",")} portion${servings > 1 ? "s" : ""} (un enfant compte pour une demi-portion).`,
    empty
      ? "Des plats simples et sans gâchis, faits surtout avec le placard. Chaque recette demande au plus 4 ingrédients à acheter, faciles à trouver au supermarché. Les 3 recettes partagent le plus possible les mêmes achats."
      : "Utilise surtout ce qui est disponible. Une recette peut demander 1 ou 2 ingrédients à acheter, pas plus.",
    "Des recettes qui existent vraiment et qu'on a envie de manger : n'associe que des ingrédients qui vont bien ensemble. Mieux vaut laisser un ingrédient de côté qu'inventer un mélange étrange.",
    "N'UTILISE PAS TOUT LE FRIGO : chaque recette prend seulement 3 à 6 ingrédients disponibles qui vont ensemble, pas toute la liste. Les 3 recettes se partagent le frigo : un ingrédient peut n'apparaître dans aucune. Ne mélange jamais sucré et salé (pas de pain au chocolat, viennoiserie, biscuit, yaourt sucré, confiture ou dessert dans un plat salé).",
    "UNE SEULE BASE PAR PLAT : jamais deux féculents principaux ensemble (pas de pâtes avec des gnocchis, pas de riz avec des pommes de terre, pas de pâtes avec du pain). Un produit tout prêt (gnocchis à la sauce, pâtes farcies, raviolis, plat cuisiné) est la base du plat à lui seul : on le complète avec des légumes, une protéine ou une garniture, jamais avec un autre produit tout prêt ni un autre féculent.",
    `VARIÉTÉ : ${count} plats de types différents (pas deux plats de pâtes, pas deux poêlées, pas deux omelettes), avec des bases différentes (pâtes, riz, pommes de terre, pain, légumineuses, œufs…). ${count > 2 ? "Au moins 2 recettes" : "Au moins 1 recette"} sont des plats du quotidien qu'on connaît en France. La dernière peut venir d'ailleurs : aujourd'hui, inspire-toi de la cuisine ${style} si les ingrédients s'y prêtent.`,
    lines.length ? `PRÉFÉRENCES (à respecter) :\n${lines.join("\n")}` : "",
    familyLines.length ? `LE FOYER :\n${familyLines.join("\n")}` : "",
    avoid.length ? `DÉJÀ PROPOSÉES RÉCEMMENT, À NE PAS REPROPOSER, ni une variante proche (le même plat avec les mêmes ingrédients principaux sous un autre nom) : ${avoid.join(" ; ")}.` : "",
    `Pour chaque recette :
- "title" : nom court et appétissant, en français. Il décrit exactement le plat : tout ce qu'il nomme (base comme wrap, pâtes, riz, ou ingrédient) est dans "ingredients". Pas de « wrap » sans galette, pas de « gratin » sans four.
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
  const ask = async () => {
    const answer = await askClaude<{ recipes?: RawRecipe[] }>([{ type: "text", text: prompt }], 4000);
    return answer.ok ? (answer.json?.recipes ?? []).map(parse).filter(r => r !== null) : null;
  };
  const first = await ask();
  if (!first) return fail(502, "Service IA temporairement indisponible.");
  let raw = first.slice(0, count);
  if (raw.length < count) {
    const again = (await ask()) ?? [];
    raw = [...raw, ...again.filter(r => !raw.some(o => norm(o.title) === norm(r.title)))].slice(0, count);
  }
  if (raw.length === 0) return fail(500, "Réponse IA invalide.");

  const recipes = await Promise.all(raw.map(async ({ r, items, steps }) => {
    const imageSearch = str(r.imageSearch, 40) || str(r.title, 80);
    return {
      title: str(r.title, 80),
      intro: str(r.intro, 300),
      minutes: Math.round(num(r.minutes) ?? 20),
      calories: Math.round(num(r.calories) ?? 400),
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
    };
  }));

  res.json({ recipes, scansLeft });
}
