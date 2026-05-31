import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = ["https://frigia.fr", "https://frigia-ten.vercel.app", "http://localhost:5173"];

// Rate limiting: 20 requests per hour per user (in-memory, best-effort on serverless)
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 3600 * 1000;

function checkRateLimit(userId: string): boolean {
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

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin as string | undefined;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
  const token = authHeader.replace("Bearer ", "");

  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  if (!checkRateLimit(user.id)) {
    return res.status(429).json({ error: "Limite atteinte. Réessayez dans une heure." });
  }

  const appMeta = user.app_metadata || {};
  const userMeta = user.user_metadata || {};
  const status = appMeta.subscription_status || userMeta.subscription_status;
  const hasAccess = appMeta.is_whitelisted || userMeta.is_whitelisted ||
    status === "active" || status === "trialing";
  if (!hasAccess) return res.status(403).json({ error: "No active subscription" });

  const { imageBase64, mediaType, prefs, recentTitles, mealType } = req.body as { imageBase64: string; mediaType: string; prefs?: { goal?: string; diet?: string[]; time?: string; equipment?: string[] }; recentTitles?: string[]; mealType?: string };
  if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });
  if (imageBase64.length > 4 * 1024 * 1024) return res.status(400).json({ error: "Image trop lourde" });

  const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const safeMediaType = SUPPORTED_TYPES.includes(mediaType) ? mediaType : "image/jpeg";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  // Build personalization constraints from questionnaire prefs
  const prefLines: string[] = [];
  if (prefs) {
    const dietMap: Record<string, string> = { veggie: "végétarien (sans viande ni poisson)", vegan: "vegan (sans aucun produit animal)", glutenfree: "sans gluten" };
    const goalMap: Record<string, string> = { healthy: "recettes saines et équilibrées", nogaspi: "recettes zéro gaspillage utilisant un maximum d'ingrédients visibles", quick: "recettes rapides à préparer" };
    const equipMap: Record<string, string> = { airfryer: "AirFryer", moulinex: "Moulinex", thermomix: "Thermomix" };
    const timeMap: Record<string, string> = { "15min": "15 minutes maximum", "30min": "30 minutes maximum" };

    const dietConstraints = (prefs.diet || []).filter(d => d !== "all").map(d => dietMap[d]).filter(Boolean);
    if (dietConstraints.length > 0) prefLines.push(`ALIMENTATION (OBLIGATOIRE sur les 3 recettes) : ${dietConstraints.join(" et ")}.`);

    const goal = prefs.goal ? goalMap[prefs.goal] : null;
    if (goal) prefLines.push(`OBJECTIF : Privilégier des ${goal}.`);

    const timeConstraint = prefs.time ? timeMap[prefs.time] : null;
    if (timeConstraint) prefLines.push(`DURÉE : Au moins 2 recettes sur 3 doivent être réalisables en ${timeConstraint}. La 3ème peut être plus longue.`);

    const equipList = (prefs.equipment || []).map(e => equipMap[e]).filter(Boolean);
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
  });

  if (!anthropicRes.ok) {
    await anthropicRes.text();
    return res.status(502).json({ error: "Service IA temporairement indisponible. Réessayez." });
  }

  const data = await anthropicRes.json() as { content?: { text?: string }[] };
  const text = (data.content || []).map((i: any) => i.text || "").join("");

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
  let parsed: any = null;
  if (jsonStr) {
    try { parsed = JSON.parse(jsonStr); } catch (e) {
      return res.status(500).json({ error: "Réponse IA invalide. Réessayez." });
    }
  }

  if (!parsed || (!parsed.ingredients?.length && !parsed.recipes?.length)) {
    return res.status(500).json({ error: "Aucun aliment détecté dans la photo. Essayez avec une image plus nette ou mieux éclairée." });
  }

  const baseRecipes = (parsed.recipes || []).slice(0, 3).map((recipe: any) => ({
    title: recipe.title || "Recette",
    time: recipe.time || "15 min",
    calories: recipe.calories || 350,
    difficulty: recipe.difficulty || "Facile",
    imageSearch: recipe.imageSearch || recipe.title,
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
        const d = await r.json() as any;
        const photos = d.photos || [];
        const photo = photos[1] || photos[0];
        if (photo) return { ...recipe, imageUrl: photo.src.large };
      } catch {}
      return recipe;
    })
  );

  res.json({ ingredients: parsed.ingredients || [], recipes });
}
