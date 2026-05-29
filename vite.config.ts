import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png', 'apple-touch-icon.png'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
          runtimeCaching: [{
            urlPattern: /^https:\/\/images\.pexels\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'pexels-images', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          }],
        },
      }),
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
                  max_tokens: 2000,
                  messages: [{
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Analyse cette photo de frigo. Retourne EXACTEMENT 3 recettes réalisables avec les ingrédients visibles. Étapes : format chef — courtes, précises, avec quantités + températures + durées, sans phrases longues. REGLE ABSOLUE imageSearch : EN ANGLAIS + TYPE DE PLAT SEULEMENT (2 mots max, ZERO ingrédient, ZERO sauce, ZERO adjectif). Exemples corrects: "scrambled eggs", "beef steak", "milkshake", "green salad", "pasta", "chicken soup", "fried rice", "omelette". JAMAIS: "eggs soy milk", "marinated steak citrus". JSON uniquement: {"ingredients":[{"name":"Tomates","confidence":95}],"recipes":[{"title":"Omelette tomate fromage","time":"12 min","calories":380,"difficulty":"Facile","imageSearch":"omelette","ingredients":[{"name":"Oeufs","qty":"3"},{"name":"Tomates","qty":"2"},{"name":"Fromage râpé","qty":"40g"},{"name":"Beurre","qty":"10g"}],"steps":["Battre 3 oeufs + sel + poivre à la fourchette 1 min, légère mousse","Couper 2 tomates en dés 1cm, égoutter papier absorbant","Poêle 24cm feu moyen (6/9), fondre 10g beurre sans brûler","Verser oeufs, spatule : ramener bords au centre + incliner poêle, 2-3 min","Garnir une moitié : tomates + 40g fromage, plier, couvrir 30s, servir"]}]}',
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

              const pexelsKey = env.PEXELS_API_KEY
              const recipesWithImages = await Promise.all(
                (parsed.recipes || []).slice(0, 3).map(async (recipe: any) => {
                  if (!pexelsKey) return recipe
                  try {
                    const query = `${recipe.imageSearch || recipe.title} food photography`
                    const pexRes = await fetch(
                      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
                      { headers: { Authorization: pexelsKey } }
                    )
                    const pexData = await pexRes.json() as any
                    const photos = pexData.photos || []
                    const photo = photos[1] || photos[0]
                    if (photo) return { ...recipe, imageUrl: photo.src.large }
                  } catch {}
                  return recipe
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
