export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, mediaType } = req.body as { imageBase64: string; mediaType: string };
  if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Analyse cette photo de frigo. Retourne EXACTEMENT 4 recettes réalisables avec les ingrédients visibles. JSON valide uniquement, sans texte avant ou après: {"ingredients":[{"name":"Tomates","confidence":95}],"recipes":[{"title":"Omelette tomate fromage","time":"8 min","calories":330,"difficulty":"Facile","imageSearch":"tomato omelette","ingredients":[{"name":"Oeufs","qty":"3"},{"name":"Tomates","qty":"2"},{"name":"Sel","qty":"1 pincée"}],"steps":["Casser les oeufs dans un bol et battre avec sel et poivre.","Couper les tomates en dés.","Faire fondre du beurre dans une poêle à feu moyen.","Verser les oeufs, ajouter les tomates, cuire 3 min et servir."]}]}',
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text();
    return res.status(502).json({ error: "Anthropic API error", detail });
  }

  const data = await anthropicRes.json() as { content?: { text?: string }[] };
  const text = (data.content || []).map((i: any) => i.text || "").join("");

  const match = text.match(/\{[\s\S]*\}/);
  let parsed: any = { ingredients: [], recipes: [] };
  try {
    if (match) parsed = JSON.parse(match[0]);
  } catch {}

  // Pass through all recipe fields including steps and ingredients
  const recipes = (parsed.recipes || []).slice(0, 4).map((recipe: any) => ({
    title: recipe.title || "Recette",
    time: recipe.time || "15 min",
    calories: recipe.calories || 350,
    difficulty: recipe.difficulty || "Facile",
    imageSearch: recipe.imageSearch || recipe.title,
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
  }));

  res.json({ ingredients: parsed.ingredients || [], recipes });
}
