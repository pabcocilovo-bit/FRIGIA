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

type Dish = Pick<CatalogRecipe, "title" | "imageSearch" | "imageUrl"> & { items?: unknown; /** Un nom de fichier imposé (recettes de la semaine) */ path?: string };

// Le même style pour toutes : on reconnaît Frigia d'une rangée à l'autre
// Le style A, choisi par Hugo le 27 octobre après ses essais dans Gemini (une tartiflette), vue à 60° : le plat se lit mieux en petite carte.
// La vaisselle artisanale, le lin beige,
// une serviette vert sauge, une fourchette ancienne. Rien d'autre sur la table : l'appli est faite pour les familles.
const style = (vessel: string) => `Shot at a 60-degree angle, the dish centered and filling most of the frame, ${vessel} on a warm beige linen tablecloth, `
  + "a sage green linen napkin, a small ceramic bowl and a vintage fork as discreet props, soft natural window light, "
  + "muted warm tones, shallow depth of field, editorial cookbook photography, realistic and appetizing, "
  // Pas de « no wine glass » : nommer le verre le faisait apparaître (tartiflette du 27 octobre)
  + "only the dish and these props on the table, no text, no logo, no people, no hands.";

// La vaisselle selon le plat (Hugo, 27 octobre : les soupes dans des bols, certains plats à l'assiette).
// Le reste (gratins, pâtes, salades…) garde le plat en céramique. v : la photo est refaite sous un autre nom.
const BAKED = /galette des rois|gratin|lasagne|hachis|parmentier|tartiflette|quiche|tarte|clafoutis|cake|g[âa]teau|moussaka|cassoulet|crumble|flan|cannelloni|tian|brownie|pudding|fondant|au four|souffl|pizza|enchilada|brandade|baked/i;
const VESSELS: { re: RegExp; text: string; v: string }[] = [
  { re: /soupe|velout|potage|bouillon|minestrone|gaspacho|ramen|\bpho\b|harira|chorba|garbure|soup|curry|chili|dahl|dhal|moules|bowl/i,
    text: "served in a deep speckled handmade ceramic bowl", v: "b1" },
  { re: /steak|escalope|filet|pav[ée]|magret|r[ôo]ti|cuisse|brochette|burger|truite|cabillaud|limande|sardine|saint-jacques|calamar|omelette|croque|galette|cr[êe]pe|blanquette|bourguignon|coq au vin|pur[ée]e|gigot|c[ôo]te de|saumon|poisson/i,
    text: "served on a flat speckled handmade ceramic dinner plate", v: "a1" },
];
// Yaourts, desserts à la cuillère et petits-déjeuners : un petit bol (Hugo, 27 octobre), avant la règle des plats au four
// (« chia pudding », « bowl cake ») ; un smoothie : un verre
const SPOON = { re: /^(yaourt|fromage blanc|skyr)|yogurt bowl|porridge|oatmeal|overnight|granola|muesli|chia|smoothie bowl|mousse (au|aux|de)|riz au lait|rice pudding|compote|panna cotta|cr[èe]me dessert|[îi]les? flottantes?|bowl cake/i,
  text: "served in a small speckled handmade ceramic bowl", v: "y1" };
const GLASS = { re: /smoothie|milkshake|lassi/i, text: "served in a tall clear glass", v: "y1" };
const vessel = (r: Dish) => {
  const t = `${r.title} ${r.imageSearch}`;
  if (SPOON.re.test(t) && !/cookie|biscuit|cake slice|loaf/i.test(t)) return SPOON;
  if (GLASS.re.test(t) && !/bowl/i.test(t)) return GLASS;
  return BAKED.test(t) || /salade|salad|rillettes/i.test(t) ? undefined : VESSELS.find(x => x.re.test(t));
};

// Les plats que le modèle dessine mal : une précision, et un nouveau nom de fichier pour refaire leur photo
// Quiches : un œuf au plat posé dessus, même sans œuf dans la consigne (27 octobre)
const FIXES: { re: RegExp; add: string; v: string }[] = [
  { re: /quiche/i, add: "a savory tart with a smooth, set, golden custard filling", v: "t2" },
  // Carbonara et pad thaï : un jaune d'œuf posé au milieu (Hugo, 27 octobre : « j'aime pas trop »)
  { re: /carbonara/i, add: "pasta tossed in a glossy, creamy carbonara sauce that coats every strand, grated cheese and crispy pancetta on top", v: "c2" },
  { re: /pad tha/i, add: "stir-fried rice noodles tossed with bean sprouts and spring onions, crushed peanuts and a lime wedge", v: "p2" },
  // Galettes, crêpes, tortillas (Hugo, 27 octobre : « fajitas, il y a une tortilla souvent ») : des fajitas sans tortilla,
  // des wraps ouverts comme des pizzas, un œuf au plat sur les crêpes et la galette des rois
  { re: /galette des rois|galette chocolat-poire/i, add: "a golden French king cake (galette des rois) of flaky puff pastry with a scored leaf pattern on top, one slice cut out", v: "g2" },
  { re: /fajita/i, add: "sizzling strips with sliced peppers and onions in a cast iron skillet, a stack of warm flour tortillas beside it and one rolled fajita on a plate", v: "f2" },
  { re: /burrito/i, add: "a large rolled flour tortilla burrito cut in half on a plate, the filling visible inside", v: "f2" },
  { re: /wrap/i, add: "a rolled flour tortilla wrap cut in half on a plate, the filling visible inside", v: "f2" },
  { re: /kebab|gyros|falafel pita/i, add: "a warm pita bread sandwich generously filled, with lettuce, tomato and a white yogurt sauce", v: "f2" },
  // Crêpes sucrées : une garniture jaune (des œufs brouillés) dans les crêpes pliées (Hugo, 28 octobre) : une pile, sans rien dedans
  { re: /french crepes|dairy free crepes/i, add: "a neat stack of thin, plain golden French crêpes on a plate, empty with no filling at all, the top one folded into quarters, lightly dusted with sugar, a small pot of jam beside", v: "f3" },
  // Galettes bretonnes : des tartes épaisses, un œuf au plat sur la galette saucisse (28 octobre). Une crêpe de sarrasin fine, pliée en carré
  { re: /galette saucisse/i, add: "a grilled sausage rolled tightly in a thin, lacy, dark brown Breton buckwheat crêpe, wrapped like a hot dog", v: "f3" },
  { re: /galette compl|buckwheat galette ham/i, add: "a thin, lacy, dark brown Breton buckwheat crêpe with its edges folded in to make a square, ham and melted grated cheese inside and one sunny-side-up egg in the center", v: "k2" },
  { re: /goat cheese spinach galette/i, add: "a thin, lacy, dark brown Breton buckwheat crêpe with its edges folded in to make a square, wilted spinach and melted goat cheese in the center", v: "k2" },
  // Gratins aux œufs : un œuf au plat posé dessus (vu sur le gratin de courgettes, 28 octobre)
  { re: /gratin de courgettes|gratin de chou-fleur et brocoli|gratin d'épinards/i, add: "a baking dish of vegetables baked in a creamy sauce under a golden, bubbling cheese crust", v: "z2" },
  // Revue du 28 octobre : des cordons bleus et des muffins salés en gratin, des gougères en plat, l'île flottante en tarte
  { re: /cordon bleu/i, add: "two golden, crispy breaded cutlets on a plate, one cut in half showing the ham and melted cheese inside", v: "q2" },
  { re: /muffins? sal|savou?ry muffin/i, add: "several golden savory muffins baked in paper cases, one broken open", v: "m2" },
  { re: /goug[èe]re/i, add: "a pile of small, round, puffed golden cheese choux pastry balls", v: "g3" },
  { re: /[îi]les? flottantes?|floating island/i, add: "soft white poached meringue clouds floating on pale vanilla custard, drizzled with golden caramel", v: "i2" },
  // Raclette : des morceaux brûlés en vrac dans un plat (Hugo, 27 octobre : « mal faite »)
  { re: /raclette au four/i, add: "a baking dish of sliced boiled potatoes generously covered with melted, bubbling raclette cheese", v: "r2" },
  { re: /raclette dinner/i, add: "a plate of boiled baby potatoes with creamy melted raclette cheese poured over them, a few slices of cured ham and small pickled gherkins on the side", v: "r2" },
  { re: /raclette/i, add: "a plate of boiled baby potatoes with creamy melted raclette cheese poured over them, small pickled gherkins on the side", v: "r2" },
];
const fix = (r: Dish) => FIXES.find(f => f.re.test(`${r.title} ${r.imageSearch}`));
const EGG = /(œ|oe)ufs?\b/i;
// Une recette avec des œufs qui ne sont pas le plat : sa photo est refaite sans eux dans la consigne (e2).
// Les plats d'œufs (omelette, œufs mimosa, shakshuka…) gardent la leur.
const eggs = (r: Dish) => Array.isArray(r.items) && (r.items as { name?: unknown }[]).some(i => EGG.test(String(i?.name ?? "")))
  && !/\beggs?\b|omelet|frittata|shakshuka|tortilla|piperade/i.test(`${r.title} ${r.imageSearch}`);
// « eggless tiramisu », « eggplant » : le mot « egg » suffit à faire venir un œuf
const subject = (s: string) => s.replace(/\beggless\s*/gi, "").replace(/eggplants?/gi, "aubergine");

function prompt(r: Dish): string {
  // Les ingrédients qui font la différence entre les variantes (lardons ou champignons…), pas ceux qui lient le plat :
  // « Visible ingredients: … œuf, crème » posait un œuf au plat sur la quiche et une cuillère de crème sur le hachis (27 octobre)
  // Les œufs jamais : « [œo]euf » laissait passer « œuf », et le modèle posait un œuf au plat sur les gaufres, le pain perdu,
  // les cordons bleus, les crèmes brûlées… (Hugo, 28 octobre). Nommer l'œuf, même pour dire « sans », le fait apparaître.
  const items = (Array.isArray(r.items) ? r.items as { name?: unknown }[] : [])
    .map(i => String(i?.name ?? "")).filter(n => n && !EGG.test(n) && !/^(sel|poivre|eau|huile|beurre|cr[èe]me|lait|farine|sucre|levure|fromage blanc|bouillon|vin|ail|herbes)/i.test(n)).slice(0, 4);
  return [
    // Pas le nom français entre guillemets : Z-Image l'écrivait sur la photo (« Tartifette au reblochon », 27 octobre)
    `Professional food photograph of ${subject(String(r.imageSearch))}, ${fix(r)?.add ?? "a home-cooked dish"}, fully cooked and served as it comes out of the kitchen`
      + (items.length ? `, made with ${items.join(", ")} cooked into the dish, nothing raw placed on top.` : "."),
    style(vessel(r)?.text ?? "served in a simple speckled handmade ceramic dish"),
  ].join(" ");
}

const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const pathOf = (r: Dish) => r.path ?? `${DIR}/${[slug(r.title), fix(r)?.v, vessel(r)?.v, eggs(r) ? "e2" : null].filter(Boolean).join("-")}.webp`;
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

// Les 6 recettes de la semaine (src/app/featured.ts), dans le même style que le catalogue (Hugo, 27 octobre).
// Leur photo : recipe-images/featured/<photo>.webp, lue par featured.ts une fois faite.
const FEATURED: Dish[] = [
  ["pancakes-banane", "Pancakes moelleux à la banane", "a stack of fluffy banana oat pancakes on a plate, banana slices and a drizzle of honey"],
  ["burger-poulet-avocat", "Burger healthy au poulet et à l'avocat", "a healthy chicken burger with avocado, tomato and lettuce in a wholemeal bun"],
  ["pizza-tortilla", "Pizza tortilla croustillante", "a thin crispy tortilla pizza with mozzarella, cherry tomatoes and fresh basil, on a flat plate"],
  ["pommes-de-terre-smashees", "Pommes de terre smashées au parmesan", "crispy golden smashed baby potatoes with parmesan and herbs"],
  ["one-pot-pasta", "One-pot pasta aux tomates et épinards", "one-pot spaghetti with cherry tomatoes and baby spinach"],
  ["brownie-banane", "Brownie fondant sans farine", "squares of fudgy flourless chocolate brownie"],
].map(([photo, title, imageSearch]) => ({ title, imageSearch, path: `featured/${photo}.webp` }) as Dish);

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
  // Les recettes de la semaine : pas dans le catalogue, on regarde si leur fichier existe
  const known = await Promise.all(FEATURED.map(r => fetch(admin.storage.from(BUCKET).getPublicUrl(r.path!).data.publicUrl, { method: "HEAD", signal: AbortSignal.timeout(5_000) }).then(x => x.ok, () => false)));
  todo.unshift(...FEATURED.filter((r, i) => !known[i] && !busy.has(r.title)));
  const batch = todo.slice(0, max);
  for (const r of batch) busy.add(r.title);
  let done = 0;
  try {
    // Toutes en même temps chez fal.ai : le paquet tient dans la minute de la fonction (vercel.json)
    const urls = await Promise.all(batch.map(r => make(admin, r).catch(e => { console.error("fal:", e instanceof Error ? e.message : e); return null; })));
    for (const [i, r] of batch.entries()) if (urls[i]) { if (!r.path) await keep(admin, r.title, urls[i]!); done++; }
  } finally {
    for (const r of batch) busy.delete(r.title);
  }
  return { done, left: todo.length - done, total: all.size };
}

/** Le fichier d'une recette du scan : comme au catalogue, mais sous scan/ */
const scanPath = (r: Dish) => `scan/${pathOf({ ...r, path: undefined }).slice(DIR.length + 1)}`;

// Les photos refaites pour les anciens scans, par personne et par heure (sur cette instance) : le coût reste borné
const restyled = new Map<string, { at: number; n: number }>();

/**
 * Les anciens scans et favoris, faits avant les photos IA (Hugo, 27 octobre : « dans tes dernières recettes, encore Pexels »).
 * La recette du catalogue reprend sa photo (ou la fait) ; une recette de l'IA a la sienne sous scan/, faite d'après son titre
 * (le nom anglais n'a pas été gardé dans l'historique). 6 au plus par appel. Rend { titre: adresse de la photo }.
 */
export async function restyle(admin: SupabaseClient, userId: string, list: { title: string; items: string[] }[]): Promise<Record<string, string>> {
  const now = Date.now();
  const used = restyled.get(userId);
  const n = used && now - used.at < 3_600_000 ? used.n : 0;
  const todo = list.slice(0, Math.max(0, Math.min(6, 60 - n)));
  restyled.set(userId, { at: used && now - used.at < 3_600_000 ? used.at : now, n: n + todo.length });
  const out: Record<string, string> = {};
  await Promise.all(todo.map(async x => {
    try {
      const { data } = await admin.from("recipe_catalog").select("recipes").filter("recipes", "cs", JSON.stringify([{ title: x.title }])).limit(1);
      const known = ((data?.[0] as { recipes: CatalogRecipe[] } | undefined)?.recipes ?? []).find(r => r.title === x.title);
      if (known && current(known)) { out[x.title] = String(known.imageUrl); return; }
      if (known) {
        const url = await make(admin, known);
        if (url) { await keep(admin, known.title, url); out[x.title] = url; }
        return;
      }
      const dish: Dish = { title: x.title, imageSearch: x.title.toLowerCase(), items: x.items.map(name => ({ name })) };
      const url = await make(admin, { ...dish, path: scanPath(dish) });
      if (url) out[x.title] = url;
    } catch (e) { console.error("fal:", e instanceof Error ? e.message : e); }
  }));
  return out;
}

/**
 * La photo IA d'une recette du scan, tout de suite (api/recipes.ts) : rangée sous scan/, reprise si le même titre revient.
 * null sans FAL_KEY, en cas d'erreur, ou après `ms` : l'appli garde alors la photo de Pexels.
 */
export async function photoNow(admin: SupabaseClient, r: Dish, ms = 12_000): Promise<string | null> {
  if (!canGenerate() || !r.title || !r.imageSearch) return null;
  const job = make(admin, { ...r, path: scanPath(r) })
    .catch(e => { console.error("fal:", e instanceof Error ? e.message : e); return null; });
  // Trop long : la photo se finit quand même (elle servira la prochaine fois), la réponse ne l'attend pas
  waitUntil(job);
  return Promise.race([job, new Promise<null>(ok => setTimeout(() => ok(null), ms))]);
}
