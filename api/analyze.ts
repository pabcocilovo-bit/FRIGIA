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
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Analyse cette photo de frigo. Retourne EXACTEMENT 4 recettes détaillées réalisables avec les ingrédients visibles. Chaque recette doit avoir AU MINIMUM 6 étapes détaillées et précises (températures, durées, techniques). JSON valide uniquement, sans texte avant ou après: {"ingredients":[{"name":"Tomates","confidence":95}],"recipes":[{"title":"Omelette tomate fromage","time":"12 min","calories":380,"difficulty":"Facile","imageSearch":"tomato cheese omelette","ingredients":[{"name":"Oeufs","qty":"3"},{"name":"Tomates","qty":"2"},{"name":"Fromage râpé","qty":"40g"},{"name":"Beurre","qty":"10g"},{"name":"Sel","qty":"1 pincée"},{"name":"Poivre","qty":"1 pincée"}],"steps":["Casser les 3 oeufs dans un bol, ajouter une pincée de sel et de poivre. Battre énergiquement à la fourchette pendant 1 minute jusqu\'à obtenir un mélange homogène et légèrement mousseux.","Laver les tomates et les couper en petits dés de 1 cm. Égoutter sur du papier absorbant pour retirer l\'excès d\'eau.","Faire chauffer une poêle antiadhésive de 24 cm à feu moyen (6/9). Ajouter le beurre et le laisser fondre sans le brûler jusqu\'à ce qu\'il mousse légèrement.","Verser les oeufs battus dans la poêle. Avec une spatule souple, ramener délicatement les bords vers le centre tout en inclinant la poêle pour que l\'oeuf liquide se répande.","Quand l\'omelette est encore légèrement baveuse sur le dessus (après environ 2-3 min), déposer les dés de tomate et le fromage râpé sur une moitié de l\'omelette.","Plier délicatement l\'omelette en deux à l\'aide de la spatule. Laisser cuire encore 30 secondes pour faire fondre le fromage. Glisser sur l\'assiette et servir immédiatement."]}]}',
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
