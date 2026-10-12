import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, authUser, isPlus, preflight, type Req, type Res } from "./_shared.js";

// Rate limiting: 20 requests per hour per user
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 3600 * 1000;

// Formule Gratuit : 15 scans au total, plus les bonus des codes (colonne bonus_scans)
const FREE_SCANS = 15;

// Shared counter in Supabase (see supabase/migrations), so it holds across serverless instances
async function checkRateLimit(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("check_scan_rate_limit", {
    p_user_id: userId,
    p_limit: RATE_LIMIT,
    p_window_seconds: RATE_WINDOW_MS / 1000,
  });
  if (!error) return data === true;
  // Migration not applied yet: fall back to the per-instance counter instead of blocking scans
  console.error("check_scan_rate_limit failed:", error.message);
  return checkMemoryRateLimit(userId);
}

const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkMemoryRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(userId, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

type Body = {
  imageBase64: string; mediaType: string; recentTitles?: string[]; mealType?: string;
  prefs?: { goal?: string; goals?: string[]; diet?: string[]; allergies?: string[]; time?: string; equipment?: string[] };
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
    const { data, error } = await admin.rpc("use_free_scan", { p_user_id: user.id, p_limit: FREE_SCANS });
    if (error) {
      console.error("use_free_scan failed:", error.message);
      return res.status(503).json({ error: "Service temporairement indisponible. Réessayez." });
    }
    if (typeof data !== "number" || data < 0) {
      return res.status(403).json({ error: "Tes scans gratuits sont utilisés.", code: "quota" });
    }
    scansLeft = data;
  }
  const fail = async (status: number, error: string) => {
    if (!plus) await admin.rpc("refund_free_scan", { p_user_id: user.id });
    return res.status(status).json({ error });
  };

  const { imageBase64, mediaType, prefs, recentTitles, mealType } = (req.body ?? {}) as Body;
  if (!imageBase64) return fail(400, "Missing imageBase64");
  if (imageBase64.length > 4 * 1024 * 1024) return fail(400, "Image trop lourde");

  const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const safeMediaType = SUPPORTED_TYPES.includes(mediaType) ? mediaType : "image/jpeg";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(500, "ANTHROPIC_API_KEY not configured");

  // Build personalization constraints from the account's tastes (profiles table).
  // Old clients still send the first questionnaire's keys (goal, healthy, veggie, 15min…): both are understood.
  const prefLines: string[] = [];
  if (prefs) {
    const dietMap: Record<string, string> = {
      vege: "végétarien (sans viande ni poisson)", veggie: "végétarien (sans viande ni poisson)",
      vegan: "vegan (sans aucun produit animal)", pesce: "pescétarien (poisson autorisé, sans viande)",
      gluten: "sans gluten", glutenfree: "sans gluten", lactose: "sans lactose",
    };
    const goalMap: Record<string, string> = {
      sain: "recettes saines et équilibrées", healthy: "recettes saines et équilibrées",
      gaspi: "recettes zéro gaspillage utilisant un maximum d'ingrédients visibles", nogaspi: "recettes zéro gaspillage utilisant un maximum d'ingrédients visibles",
      temps: "recettes rapides à préparer", quick: "recettes rapides à préparer",
      budget: "recettes économiques, avec ce qu'il y a déjà", idees: "recettes variées qui sortent de la routine",
    };
    const equipMap: Record<string, string> = { airfryer: "AirFryer", moulinex: "Moulinex", thermomix: "Thermomix" };
    const timeMap: Record<string, string> = { "15": "15 minutes maximum", "30": "30 minutes maximum", "15min": "15 minutes maximum", "30min": "30 minutes maximum" };

    const dietConstraints = (prefs.diet || []).map(d => dietMap[d]).filter(Boolean);
    if (dietConstraints.length > 0) prefLines.push(`ALIMENTATION (OBLIGATOIRE sur les 3 recettes) : ${dietConstraints.join(" et ")}.`);

    const allergies = (prefs.allergies || []).filter(a => typeof a === "string" && a.length < 40);
    if (allergies.length > 0) prefLines.push(`ALLERGIES (OBLIGATOIRE) : aucune recette ne doit contenir ${allergies.join(", ")}.`);

    const goals = [...(prefs.goals || []), ...(prefs.goal ? [prefs.goal] : [])].map(g => goalMap[g]).filter(Boolean);
    if (goals.length > 0) prefLines.push(`OBJECTIF : Privilégier des ${goals.slice(0, 2).join(" et des ")}.`);

    const timeConstraint = prefs.time ? timeMap[prefs.time] : null;
    if (timeConstraint) prefLines.push(`DURÉE : Au moins 2 recettes sur 3 doivent être réalisables en ${timeConstraint}. La 3ème peut être plus longue.`);

    const equipList = (prefs.equipment || []).map(e => equipMap[e.toLowerCase()] ?? e).filter(e => typeof e === "string" && e.length < 40);
    if (equipList.length > 0) prefLines.push(`ÉQUIPEMENT : L'utilisateur possède ${equipList.join(", ")}. Exactement 1 recette sur 3 peut suggérer d'utiliser cet équipement (les autres doivent rester classiques).`);
  }
  const prefBlock = prefLines.length > 0 ? `\n\nPRÉFÉRENCES UTILISATEUR :\n${prefLines.join("\n")}` : "";
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

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyse cette photo de frigo. Retourne EXACTEMENT 3 recettes réalisables avec les ingrédients visibles. Étapes : format chef — courtes, précises, avec quantités + températures + durées, sans phrases longues. REGLE ABSOLUE imageSearch : EN ANGLAIS + TYPE DE PLAT SEULEMENT (2 mots max, ZERO ingrédient, ZERO sauce, ZERO adjectif). Exemples corrects: "scrambled eggs", "beef steak", "milkshake", "green salad", "pasta", "chicken soup", "fried rice", "omelette". JAMAIS: "eggs soy milk", "marinated steak citrus".${prefBlock}${avoidBlock}${mealTypeBlock} JSON uniquement: {"ingredients":[{"name":"Tomates","confidence":95}],"recipes":[{"title":"Omelette tomate fromage","time":"12 min","calories":380,"difficulty":"Facile","imageSearch":"omelette","ingredients":[{"name":"Oeufs","qty":"3"},{"name":"Tomates","qty":"2"},{"name":"Fromage râpé","qty":"40g"},{"name":"Beurre","qty":"10g"}],"steps":["Battre 3 oeufs + sel + poivre à la fourchette 1 min, légère mousse","Couper 2 tomates en dés 1cm, égoutter papier absorbant","Poêle 24cm feu moyen (6/9), fondre 10g beurre sans brûler","Verser oeufs, spatule : ramener bords au centre + incliner poêle, 2-3 min","Garnir une moitié : tomates + 40g fromage, plier, couvrir 30s, servir"]}]}`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: safeMediaType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
    }),
  }).catch(() => null);

  if (!anthropicRes?.ok) {
    await anthropicRes?.text();
    return fail(502, "Service IA temporairement indisponible. Réessayez.");
  }

  const data = await anthropicRes.json() as { content?: { text?: string }[] };
  const text = (data.content || []).map(i => i.text || "").join("");

  // Extract the first balanced JSON object (avoids greedy regex cutting across braces)
  function extractFirstJSON(str: string): string | null {
    const start = str.indexOf("{");
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === "{") depth++;
      else if (str[i] === "}") { depth--; if (depth === 0) return str.slice(start, i + 1); }
    }
    return null;
  }

  const jsonStr = extractFirstJSON(text);
  let parsed: { ingredients?: unknown[]; recipes?: RawRecipe[] } | null = null;
  if (jsonStr) {
    try { parsed = JSON.parse(jsonStr); } catch {
      return fail(500, "Réponse IA invalide. Réessayez.");
    }
  }

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

  const pexelsKey = process.env.PEXELS_API_KEY;
  const recipes = await Promise.all(
    baseRecipes.map(async (recipe: typeof baseRecipes[number]) => {
      if (!pexelsKey) return recipe;
      try {
        const query = `${recipe.imageSearch} food photography`;
        const r = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
          { headers: { Authorization: pexelsKey } }
        );
        const d = await r.json() as { photos?: { src: { large: string } }[] };
        const photos = d.photos || [];
        const photo = photos[1] || photos[0];
        if (photo) return { ...recipe, imageUrl: photo.src.large };
      } catch { /* sans photo, la recette reste */ }
      return recipe;
    })
  );

  res.json({ ingredients: parsed.ingredients || [], recipes, scansLeft });
}
