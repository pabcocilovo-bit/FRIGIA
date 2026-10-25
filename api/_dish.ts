// Explorer (V3, demandé par Hugo le 25 octobre) : une recette demandée par son nom, avec ou sans frigo plein.
// « Tartiflette » : la recette classique, puis 2 variantes qui ont du sens pour ce plat (plus légère, sans crème, végé…).
// Un ingrédient ou une envie (« saumon », « rapide », « petit budget ») : 3 plats différents.
// Réservé à Frigia Plus (et aux 7 jours d'essai), dans la limite des « autres idées » (20 par heure).
// Appelé par api/recipes.ts quand la demande a un « query » : Vercel Hobby limite le nombre de fonctions (12).
import type { Req, Res } from "./_shared.js";
import { askClaude, checkIdeasLimit, prefLines, type Prefs } from "./_ai.js";
import { parse, type RawRecipe, salvage, shape, str, strs } from "./_recipe.js";

export type DishBody = {
  query?: unknown;
  /** Ce qu'on a déjà (Ma cuisine) : marqué « have » dans les ingrédients */
  kitchen?: unknown;
  servings?: unknown;
  prefs?: Prefs;
  /** Frigia Plus : le foyer (allergies obligatoires, ce qu'ils n'aiment pas) */
  eaters?: { name?: unknown; allergies?: unknown; dislikes?: unknown }[];
};

/** L'utilisateur est déjà vérifié (connecté, Plus ou essai) par api/recipes.ts. */
export async function dish(req: Req, res: Res, userId: string) {
  const body = (req.body ?? {}) as DishBody;
  const query = str(body.query, 80);
  if (query.length < 2) return res.status(400).json({ error: "Écris le nom d'une recette" });
  if (!checkIdeasLimit(userId)) return res.status(429).json({ error: "Limite atteinte. Réessaie dans une heure.", code: "rate" });

  const kitchen = strs(body.kitchen, 60, 40);
  const servings = Math.min(60, Math.max(1, Math.round(Number(body.servings) || 2)));
  const lines = prefLines(body.prefs);
  const eaters = (Array.isArray(body.eaters) ? body.eaters : []).slice(0, 12).map(e => ({
    name: str(e?.name, 20) || "Quelqu'un", allergies: strs(e?.allergies, 10, 30), dislikes: strs(e?.dislikes, 10, 24),
  }));
  const familyLines = [
    ...eaters.filter(e => e.allergies.length).map(e => `ALLERGIE DE ${e.name.toUpperCase()} (OBLIGATOIRE) : aucune recette ne doit contenir ${e.allergies.join(", ")}, même en petite quantité.`),
    ...eaters.filter(e => e.dislikes.length).map(e => `${e.name} n'aime pas : ${e.dislikes.join(", ")} (à éviter si le plat le permet).`),
  ];

  const prompt = [
    `La personne cherche : « ${query} ».`,
    `Si c'est le nom d'un plat (« tartiflette », « lasagnes », « poke bowl ») : propose EXACTEMENT 3 recettes de ce plat.
- La 1re est la recette classique, celle qu'on connaît : "variant" vaut "La classique".
- Les 2 suivantes sont des variantes qui ont du sens pour CE plat, choisies parmi : plus légère, sans crème, sans gluten, végétarienne, express, petit budget, version enfants, version au four… Une variante garde l'esprit du plat. "variant" : 2 à 3 mots (« Plus légère », « Sans crème », « Végétarienne »).
Si c'est un ingrédient, une envie ou une catégorie (« saumon », « healthy », « rapide », « petit budget », « dessert ») : propose 3 plats DIFFÉRENTS qui y répondent, connus et qu'on a envie de manger. "variant" vaut "".`,
    kitchen.length ? `Déjà à la maison : ${kitchen.join(", ")}. Les ingrédients de cette liste ont "have" : true, les autres "have" : false.` : `Rien n'est connu de ce qu'il y a à la maison : tous les ingrédients ont "have" : false, sauf sel, poivre et eau.`,
    `Quantités pour ${servings} portion${servings > 1 ? "s" : ""}.`,
    lines.length ? `PRÉFÉRENCES (à respecter, même pour la recette classique : adapte-la si besoin) :\n${lines.join("\n")}` : "",
    familyLines.length ? `LE FOYER :\n${familyLines.join("\n")}` : "",
    `Pour chaque recette :
- "title" : nom court et appétissant, en français (« Tartiflette au reblochon », « Tartiflette légère au yaourt »).
- "variant" : voir plus haut. "change" : pour une variante, 1 phrase courte sur ce qui change par rapport à la classique (« La crème est remplacée par du fromage blanc. »), sinon "".
- "intro" : 1 ou 2 phrases simples qui donnent envie, au tutoiement.
- "origin" : "" pour un plat courant en France, sinon 2 à 4 mots ("Spécialité savoyarde", "Plat indien").
- "minutes" : durée totale. "calories" : kcal par portion. "difficulty" : "Facile", "Moyen" ou "Difficile".
- "imageSearch" : le plat EN ANGLAIS, 2 à 4 mots, le dernier mot est le type de plat ("tartiflette potato gratin", "salmon poke bowl").
- "veg" : true si sans viande ni poisson. "oven" : true si elle passe au four. "cold" : true si elle se mange froide. "dessert" : true pour un dessert.
- "ingredients" : chaque ingrédient avec "name" (minuscules, singulier), "plural", "qty" (nombre, ou null pour « un peu »), "unit" ("g", "ml", "cl", "c. à s.", "c. à c.", "gousse", "feuilles", "tranches", ou "" pour un nombre de pièces), "have".
- "missing" : les ingrédients avec "have" : false, avec leur article, en minuscules ("le reblochon et les lardons"), ou "".
- "steps" : 3 à 8 étapes au tutoiement, phrases courtes, avec quantités, températures et durées. Une étape qui attend (four, cuisson, repos) a un "timer" : {"label":"Four","min":25}, sinon null.`,
    `JSON uniquement : {"recipes":[{"title":"Tartiflette au reblochon","variant":"La classique","change":"","intro":"…","origin":"Spécialité savoyarde","minutes":60,"calories":750,"difficulty":"Facile","imageSearch":"tartiflette potato gratin","veg":false,"oven":true,"cold":false,"dessert":false,"ingredients":[{"name":"pomme de terre","plural":"pommes de terre","qty":800,"unit":"g","have":false}],"missing":"…","steps":[{"text":"…","timer":null}]}]}`,
  ].filter(Boolean).join("\n");

  const answer = await askClaude<{ recipes?: (RawRecipe & { variant?: unknown; change?: unknown; dessert?: unknown })[] }>([{ type: "text", text: prompt }], 7000);
  if (!answer.ok) return res.status(502).json({ error: "Service IA temporairement indisponible." });
  const found = (Array.isArray(answer.json?.recipes) ? answer.json.recipes : salvage(answer.text)) as (RawRecipe & { variant?: unknown; change?: unknown; dessert?: unknown })[];
  const valid = found.map(r => ({ raw: r, p: parse(r) })).filter(x => x.p !== null).slice(0, 3);
  if (!valid.length) {
    console.warn(`dish « ${query} » : aucune recette valide`, answer.text.slice(0, 1500));
    return res.status(422).json({ error: "Pas de recette trouvée. Essaie un autre nom.", code: "none" });
  }
  const recipes = await Promise.all(valid.map(({ raw, p }) => shape(raw, p!.items, p!.steps, servings, {
    variant: str(raw.variant, 30),
    change: str(raw.change, 160),
    ...(raw.dessert === true ? { dessert: true } : {}),
  })));
  res.json({ recipes });
}
