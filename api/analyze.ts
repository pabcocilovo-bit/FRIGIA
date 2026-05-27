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
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Analyse cette photo de frigo. Retourne EXACTEMENT 4 recettes réalisables avec les ingrédients visibles. JSON valide uniquement, sans texte avant ou après: {"ingredients":[{"name":"Tomates","confidence":95}],"recipes":[{"title":"Omelette tomate fromage","time":"8 min","calories":330,"difficulty":"Facile","imageSearch":"tomato omelette"},{"title":"...","time":"...","calories":0,"difficulty":"...","imageSearch":"english food keyword"}]}',
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

  const data = await anthropicRes.json();
  const text = (data.content || []).map((i: any) => i.text || "").join("");

  const match = text.match(/\{[\s\S]*\}/);
  let parsed: any = { ingredients: [], recipes: [] };
  try {
    if (match) parsed = JSON.parse(match[0]);
  } catch {}

  const recipesWithImages = await Promise.all(
    (parsed.recipes || []).slice(0, 4).map(async (recipe: any) => {
      const searchTerm = recipe.imageSearch || recipe.title;
      let imageUrl = `https://loremflickr.com/640/360/${encodeURIComponent(searchTerm)},food/all`;

      try {
        const mealRes = await fetch(
          `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchTerm)}`
        );
        const mealData = await mealRes.json();
        if (mealData.meals?.[0]?.strMealThumb) {
          imageUrl = mealData.meals[0].strMealThumb;
        }
      } catch {}

      return { ...recipe, imageUrl };
    })
  );

  res.json({ ingredients: parsed.ingredients || [], recipes: recipesWithImages });
}
