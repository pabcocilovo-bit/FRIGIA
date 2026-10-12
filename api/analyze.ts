// Ancien scan en un seul appel (photo -> ingrédients et 3 recettes). Gardé pour les téléphones qui ont encore
// l'ancienne appli en mémoire ; la nouvelle appelle /api/ingredients puis /api/recipes.
import { adminClient, authUser, isPlus, preflight, type Req, type Res } from "./_shared.js";
import { askClaude, checkRateLimit, dishPhoto, prefLines, refundFreeScan, SUPPORTED_TYPES, takeFreeScan, type Prefs } from "./_ai.js";

type Body = {
  imageBase64: string; mediaType: string; recentTitles?: string[]; mealType?: string;
  prefs?: Prefs;
};
type RawRecipe = { title?: string; time?: string; calories?: number; difficulty?: string; imageSearch?: string; ingredients?: unknown; steps?: unknown };

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const admin = adminClient();
  const user = await authUser(req, admin);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  if (!(await checkRateLimit(admin, user.id))) {
    return res.status(429).json({ error: "Limite atteinte. Réessayez dans une heure." });
  }

  // Gratuit : un scan est compté avant l'analyse (le 16e est refusé), et rendu si l'analyse échoue
  const plus = isPlus(user);
  let scansLeft: number | null = null;
  if (!plus) {
    scansLeft = await takeFreeScan(admin, user.id);
    if (scansLeft === null) return res.status(503).json({ error: "Service temporairement indisponible. Réessayez." });
    if (scansLeft < 0) return res.status(403).json({ error: "Tes scans gratuits sont utilisés.", code: "quota" });
  }
  const fail = async (status: number, error: string) => {
    if (!plus) await refundFreeScan(admin, user.id);
    return res.status(status).json({ error });
  };

  const { imageBase64, mediaType, prefs, recentTitles, mealType } = (req.body ?? {}) as Body;
  if (!imageBase64) return fail(400, "Missing imageBase64");
  if (imageBase64.length > 4 * 1024 * 1024) return fail(400, "Image trop lourde");

  const safeMediaType = SUPPORTED_TYPES.includes(mediaType) ? mediaType : "image/jpeg";

  const lines = prefLines(prefs);
  const prefBlock = lines.length > 0 ? `\n\nPRÉFÉRENCES UTILISATEUR :\n${lines.join("\n")}` : "";
  const avoidBlock = recentTitles && recentTitles.length > 0
    ? `\n\nRECETTES DÉJÀ PROPOSÉES (NE PAS RÉPÉTER) : ${recentTitles.join(", ")}. Propose des recettes différentes même si les ingrédients sont similaires.`
    : "";
  const mealTypeMap: Record<string, string> = {
    protein: "TYPE DE PLAT : Les 3 recettes doivent être riches en protéines (viande, poisson, œufs, légumineuses).",
    healthy: "TYPE DE PLAT : Les 3 recettes doivent être légères, équilibrées et peu caloriques.",
    gourmand: "TYPE DE PLAT : Les 3 recettes doivent être généreuses, savoureuses et réconfortantes.",
    mix: "TYPE DE PLAT : Propose exactement 1 recette protéinée, 1 recette healthy, 1 recette gourmande.",
  };
  const mealTypeBlock = mealType && mealTypeMap[mealType] ? `\n\n${mealTypeMap[mealType]}` : "";

  const answer = await askClaude<{ ingredients?: unknown[]; recipes?: RawRecipe[] }>([
    { type: "text", text: `Analyse cette photo de frigo. Retourne EXACTEMENT 3 recettes réalisables avec les ingrédients visibles. Étapes : format chef — courtes, précises, avec quantités + températures + durées, sans phrases longues. REGLE ABSOLUE imageSearch : EN ANGLAIS + TYPE DE PLAT SEULEMENT (2 mots max, ZERO ingrédient, ZERO sauce, ZERO adjectif). Exemples corrects: "scrambled eggs", "beef steak", "milkshake", "green salad", "pasta", "chicken soup", "fried rice", "omelette". JAMAIS: "eggs soy milk", "marinated steak citrus".${prefBlock}${avoidBlock}${mealTypeBlock} JSON uniquement: {"ingredients":[{"name":"Tomates","confidence":95}],"recipes":[{"title":"Omelette tomate fromage","time":"12 min","calories":380,"difficulty":"Facile","imageSearch":"omelette","ingredients":[{"name":"Oeufs","qty":"3"},{"name":"Tomates","qty":"2"},{"name":"Fromage râpé","qty":"40g"},{"name":"Beurre","qty":"10g"}],"steps":["Battre 3 oeufs + sel + poivre à la fourchette 1 min, légère mousse","Couper 2 tomates en dés 1cm, égoutter papier absorbant","Poêle 24cm feu moyen (6/9), fondre 10g beurre sans brûler","Verser oeufs, spatule : ramener bords au centre + incliner poêle, 2-3 min","Garnir une moitié : tomates + 40g fromage, plier, couvrir 30s, servir"]}]}` },
    { type: "image", source: { type: "base64", media_type: safeMediaType, data: imageBase64 } },
  ], 2000);
  if (!answer.ok) return fail(502, "Service IA temporairement indisponible. Réessayez.");
  const parsed = answer.json;

  if (!parsed || (!parsed.ingredients?.length && !parsed.recipes?.length)) {
    return fail(500, "Aucun aliment détecté dans la photo. Essayez avec une image plus nette ou mieux éclairée.");
  }

  const baseRecipes = (parsed.recipes || []).slice(0, 3).map(recipe => ({
    title: recipe.title || "Recette",
    time: recipe.time || "15 min",
    calories: recipe.calories || 350,
    difficulty: recipe.difficulty || "Facile",
    imageSearch: recipe.imageSearch || recipe.title || "",
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
  }));

  const recipes = await Promise.all(baseRecipes.map(async recipe => {
    const imageUrl = await dishPhoto(recipe.imageSearch);
    return imageUrl ? { ...recipe, imageUrl } : recipe;
  }));

  res.json({ ingredients: parsed.ingredients || [], recipes, scansLeft });
}
