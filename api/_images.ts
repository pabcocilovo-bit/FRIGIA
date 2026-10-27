// Les photos des recettes du catalogue, générées par l'IA (Hugo, 27 octobre : les photos de Pexels étaient trop approximatives).
// Une image par recette, toutes dans le même style, faite une fois par fal.ai, gardée dans Supabase Storage
// (bucket recipe-images, migration 20261031000000_images_recettes.sql) puis dans le catalogue, sur toutes les copies de la recette.
// Faite après la réponse (waitUntil) : la page ne l'attend pas, la photo arrive à la visite suivante.
// Sans FAL_KEY (Vercel), rien ne change : les photos de Pexels restent.
import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import type { CatalogRecipe } from "./_catalog.js";

const BUCKET = "recipe-images";
// Z-Image Turbo : photoréaliste et le moins cher (~0,005 $ l'image, ~5 $ pour le catalogue, tarifs fal.ai montrés par Hugo le 27 octobre).
// FAL_MODEL sur Vercel pour en essayer un autre : fal-ai/nano-banana (~0,04 $), fal-ai/nano-banana-2 (~0,08 $), fal-ai/flux/schnell…
const MODEL = process.env.FAL_MODEL || "fal-ai/z-image/turbo";

// v3 : sans la liste « Visible ingredients » (la v2 posait des ingrédients crus sur le plat). Les anciennes restent dans le stockage, plus utilisées.
const DIR = "catalog/v3";
/** Une photo déjà générée dans la version en cours (les autres, de Pexels ou d'une ancienne version, seront remplacées) */
export const generated = (url: unknown) => typeof url === "string" && url.includes(`/object/public/${BUCKET}/${DIR}/`);
export const canGenerate = () => !!process.env.FAL_KEY;

type Dish = Pick<CatalogRecipe, "title" | "imageSearch" | "imageUrl"> & { items?: unknown };

// Le même style pour toutes : on reconnaît Frigia d'une rangée à l'autre
// Le style A, choisi par Hugo le 27 octobre après ses essais dans Gemini (une tartiflette), vue à 60° : le plat se lit mieux en petite carte.
// La vaisselle artisanale, le lin beige,
// une serviette vert sauge, une fourchette ancienne. Rien d'autre sur la table : l'appli est faite pour les familles.
const STYLE = "Shot at a 60-degree angle, the dish centered and filling most of the frame, served in a simple speckled handmade ceramic dish on a warm beige linen tablecloth, "
  + "a sage green linen napkin, a small ceramic bowl and a vintage fork as discreet props, soft natural window light, "
  + "muted warm tones, shallow depth of field, editorial cookbook photography, realistic and appetizing, "
  // Pas de « no wine glass » : nommer le verre le faisait apparaître (tartiflette du 27 octobre)
  + "only the dish and these props on the table, no text, no logo, no people, no hands.";

// Les plats que le modèle dessine mal : une précision, et un nouveau nom de fichier pour refaire leur photo
// Quiches : un œuf au plat posé dessus, même sans œuf dans la consigne (27 octobre)
const FIXES: { re: RegExp; add: string; v: string }[] = [
  { re: /quiche/i, add: "a savory tart with a smooth, set, golden custard filling, the egg fully baked into the custard", v: "t2" },
  // Carbonara et pad thaï : un jaune d'œuf posé au milieu (Hugo, 27 octobre : « j'aime pas trop »)
  { re: /carbonara/i, add: "pasta tossed in a glossy, creamy carbonara sauce that coats every strand, the egg fully mixed into the sauce, grated cheese on top", v: "c2" },
  { re: /pad tha/i, add: "stir-fried rice noodles with the egg scrambled and mixed through, crushed peanuts, bean sprouts and a lime wedge", v: "p2" },
  // Raclette : des morceaux brûlés en vrac dans un plat (Hugo, 27 octobre : « mal faite »)
  { re: /raclette au four/i, add: "a baking dish of sliced boiled potatoes generously covered with melted, bubbling raclette cheese", v: "r2" },
  { re: /raclette dinner/i, add: "a plate of boiled baby potatoes with creamy melted raclette cheese poured over them, a few slices of cured ham and small pickled gherkins on the side", v: "r2" },
  { re: /raclette/i, add: "a plate of boiled baby potatoes with creamy melted raclette cheese poured over them, small pickled gherkins on the side", v: "r2" },
];
const fix = (r: Dish) => FIXES.find(f => f.re.test(`${r.title} ${r.imageSearch}`));

function prompt(r: Dish): string {
  // Les ingrédients qui font la différence entre les variantes (lardons ou champignons…), pas ceux qui lient le plat :
  // « Visible ingredients: … œuf, crème » posait un œuf au plat sur la quiche et une cuillère de crème sur le hachis (27 octobre)
  const items = (Array.isArray(r.items) ? r.items as { name?: unknown }[] : [])
    .map(i => String(i?.name ?? "")).filter(n => n && !/^(sel|poivre|eau|huile|beurre|cr[èe]me|lait|farine|sucre|levure|fromage blanc|[œo]euf|bouillon|vin|ail|herbes)/i.test(n)).slice(0, 4);
  return [
    // Pas le nom français entre guillemets : Z-Image l'écrivait sur la photo (« Tartifette au reblochon », 27 octobre)
    `Professional food photograph of ${r.imageSearch}, ${fix(r)?.add ?? "a home-cooked dish"}, fully cooked and served as it comes out of the kitchen`
      + (items.length ? `, made with ${items.join(", ")} cooked into the dish, nothing raw placed on top.` : "."),
    STYLE,
  ].join(" ");
}

const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const pathOf = (r: Dish) => `${DIR}/${slug(r.title)}${fix(r) ? `-${fix(r)!.v}` : ""}.webp`;
/** La photo de cette recette est celle de la consigne en cours (sinon, on la refait) */
const current = (r: Dish) => generated(r.imageUrl) && String(r.imageUrl).endsWith(`/${pathOf(r)}`);

/** fal.ai → l'image, puis Supabase Storage → son adresse publique */
async function make(admin: SupabaseClient, r: Dish): Promise<string | null> {
  const path = pathOf(r);
  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  // Déjà faite (le catalogue n'a pas suivi) : on la reprend sans repayer
  const known = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(5_000) }).catch(() => null);
  if (known?.ok) return publicUrl;
  const res = await fetch(`https://fal.run/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
    // Les modèles Nano Banana prennent un format (aspect_ratio), les autres une taille (image_size)
    body: JSON.stringify(MODEL.includes("nano-banana")
      ? { prompt: prompt(r), num_images: 1, aspect_ratio: "1:1", output_format: "jpeg" }
      // 768 px en WebP : assez pour la recette du jour sur un téléphone, et bien plus léger (1 Mo l'image en JPEG 1024)
      : { prompt: prompt(r), image_size: { width: 768, height: 768 }, num_images: 1, enable_safety_checker: true, output_format: "webp" }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) { console.error("fal:", res.status, (await res.text()).slice(0, 300)); return null; }
  const url = ((await res.json()) as { images?: { url?: string }[] }).images?.[0]?.url;
  if (!url) return null;
  const img = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!img.ok) return null;
  const { error } = await admin.storage.from(BUCKET).upload(path, await img.arrayBuffer(), { contentType: MODEL.includes("nano-banana") ? "image/jpeg" : "image/webp", upsert: true, cacheControl: "31536000" });
  if (error) { console.error("recipe-images:", error.message); return null; }
  return publicUrl;
}

/** La photo sur toutes les lignes du catalogue qui ont cette recette (le plat et les réserves) */
async function keep(admin: SupabaseClient, title: string, imageUrl: string) {
  // jsonb @> [{"title": …}] : contains() de supabase-js écrirait un tableau Postgres ({…}), pas du JSON
  const { data, error } = await admin.from("recipe_catalog").select("key, recipes").filter("recipes", "cs", JSON.stringify([{ title }]));
  if (error) { console.error("recipe_catalog:", error.message); return; }
  for (const row of (data ?? []) as { key: string; recipes: CatalogRecipe[] }[]) {
    const recipes = row.recipes.map(r => (r.title === title ? { ...r, imageUrl } : r));
    const up = await admin.from("recipe_catalog").update({ recipes, updated_at: new Date().toISOString() }).eq("key", row.key);
    if (up.error) console.error("recipe_catalog:", up.error.message);
  }
}

// Déjà en cours sur cette instance : pas deux fois la même image
const busy = new Set<string>();

/** Les photos qui manquent (max par visite), faites après la réponse. Rien sans FAL_KEY. */
export function photograph(admin: SupabaseClient, recipes: Dish[], max: number) {
  if (!canGenerate()) return;
  const seen = new Set<string>();
  const todo = recipes.filter(r => r.title && r.imageSearch && !current(r) && !busy.has(r.title) && !seen.has(r.title) && !!seen.add(r.title)).slice(0, max);
  if (!todo.length) return;
  for (const r of todo) busy.add(r.title);
  waitUntil((async () => {
    const urls = await Promise.all(todo.map(r => make(admin, r).catch(e => { console.error("fal:", e instanceof Error ? e.message : e); return null; })));
    // L'une après l'autre : deux recettes de la même ligne ne s'écrasent pas
    for (const [i, r] of todo.entries()) if (urls[i]) await keep(admin, r.title, urls[i]!);
    for (const r of todo) busy.delete(r.title);
  })());
}

/**
 * Tout le catalogue d'un coup (Hugo, 27 octobre : « on peut tout remplacer »). Appelé en boucle par explorer?photos=1 :
 * chaque appel fait les photos qui manquent, par paquet de `max`, et dit combien il en reste.
 * Le coût a une fin : une recette qui a sa photo ne repasse plus, et une image déjà stockée est reprise sans repayer.
 */
export async function backfill(admin: SupabaseClient, max: number): Promise<{ done: number; left: number; total: number }> {
  const { data, error } = await admin.from("recipe_catalog").select("recipes");
  if (error) throw new Error(error.message);
  const all = new Map<string, Dish>();
  for (const row of (data ?? []) as { recipes: CatalogRecipe[] }[]) {
    for (const r of row.recipes ?? []) {
      if (!r?.title || !r.imageSearch) continue;
      // Une copie de la recette a déjà sa photo : c'est fait (keep() les met toutes à jour)
      if (current(r)) all.set(r.title, r);
      else if (!all.has(r.title)) all.set(r.title, r);
    }
  }
  const todo = [...all.values()].filter(r => !current(r) && !busy.has(r.title));
  const batch = todo.slice(0, max);
  for (const r of batch) busy.add(r.title);
  let done = 0;
  try {
    // Toutes en même temps chez fal.ai : le paquet tient dans la minute de la fonction (vercel.json)
    const urls = await Promise.all(batch.map(r => make(admin, r).catch(e => { console.error("fal:", e instanceof Error ? e.message : e); return null; })));
    for (const [i, r] of batch.entries()) if (urls[i]) { await keep(admin, r.title, urls[i]!); done++; }
  } finally {
    for (const r of batch) busy.delete(r.title);
  }
  return { done, left: todo.length - done, total: all.size };
}
