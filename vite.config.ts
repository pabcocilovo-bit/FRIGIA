import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'api-analyze',
        configureServer(server) {
          server.middlewares.use('/api/analyze', async (req: IncomingMessage, res: ServerResponse) => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')

            if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return }
            if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return }

            try {
              const body = JSON.parse(await readBody(req))
              const { imageBase64, mediaType } = body

              const apiKey = env.ANTHROPIC_API_KEY
              if (!apiKey) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY manquante dans .env' }))
                return
              }

              const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-6',
                  max_tokens: 4000,
                  messages: [{
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Analyse cette photo de frigo. Retourne EXACTEMENT 4 recettes détaillées réalisables avec les ingrédients visibles. Chaque recette doit avoir AU MINIMUM 6 étapes détaillées et précises (températures, durées, techniques). JSON valide uniquement, sans texte avant ou après: {"ingredients":[{"name":"Tomates","confidence":95}],"recipes":[{"title":"Omelette tomate fromage","time":"12 min","calories":380,"difficulty":"Facile","imageSearch":"tomato cheese omelette","ingredients":[{"name":"Oeufs","qty":"3"},{"name":"Tomates","qty":"2"},{"name":"Fromage râpé","qty":"40g"},{"name":"Beurre","qty":"10g"},{"name":"Sel","qty":"1 pincée"},{"name":"Poivre","qty":"1 pincée"}],"steps":["Casser les 3 oeufs dans un bol, ajouter une pincée de sel et de poivre. Battre énergiquement à la fourchette pendant 1 minute jusqu\'à obtenir un mélange homogène et légèrement mousseux.","Laver les tomates et les couper en petits dés de 1 cm. Égoutter sur du papier absorbant pour retirer l\'excès d\'eau.","Faire chauffer une poêle antiadhésive de 24 cm à feu moyen (6/9). Ajouter le beurre et le laisser fondre sans le brûler jusqu\'à ce qu\'il mousse légèrement.","Verser les oeufs battus dans la poêle. Avec une spatule souple, ramener délicatement les bords vers le centre tout en inclinant la poêle pour que l\'oeuf liquide se répande.","Quand l\'omelette est encore légèrement baveuse sur le dessus (après environ 2-3 min), déposer les dés de tomate et le fromage râpé sur une moitié de l\'omelette.","Plier délicatement l\'omelette en deux à l\'aide de la spatule. Laisser cuire encore 30 secondes pour faire fondre le fromage. Glisser sur l\'assiette et servir immédiatement."]}]}',
                      },
                      {
                        type: 'image',
                        source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 },
                      },
                    ],
                  }],
                }),
              })

              if (!anthropicRes.ok) {
                const detail = await anthropicRes.text()
                res.statusCode = 502
                res.end(JSON.stringify({ error: 'Anthropic API error', detail }))
                return
              }

              const data = await anthropicRes.json() as any
              const text = (data.content || []).map((i: any) => i.text || '').join('')
              const match = text.match(/\{[\s\S]*\}/)
              let parsed: any = { ingredients: [], recipes: [] }
              try { if (match) parsed = JSON.parse(match[0]) } catch {}

              const recipesWithImages = await Promise.all(
                (parsed.recipes || []).slice(0, 4).map(async (recipe: any) => {
                  const searchTerm = recipe.imageSearch || recipe.title
                  let imageUrl = ''
                  try {
                    const mealRes = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchTerm)}`)
                    const mealData = await mealRes.json() as any
                    if (mealData.meals?.[0]?.strMealThumb) imageUrl = mealData.meals[0].strMealThumb
                  } catch {}
                  return { ...recipe, imageUrl }
                })
              )

              res.end(JSON.stringify({ ingredients: parsed.ingredients || [], recipes: recipesWithImages }))
            } catch (err: any) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(err?.message ?? err) }))
            }
          })
        },
      },
    ],
  }
})
