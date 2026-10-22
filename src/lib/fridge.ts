// Ma cuisine : ce qu'il y a dans le frigo et les placards, sans rien taper.
// Un scan du frigo remplace ce qui est au frigo (la photo montre ce qu'il y a maintenant), un scan des placards ce qui est aux placards.
// Un ticket s'ajoute, rangé d'après le nom. Une course cochée y entre (décochée, elle en sort).
// Une recette cuisinée retire ce qu'elle a pris, et « Remettre » annule.
import type { DetectedIngredient, GeneratedRecipe } from "./types";
import type { Fridge, FridgeItem, Place } from "./home";
import { aisleOf, norm, same, sumQty } from "./shopping";
import type { ScanSource } from "./scan";
import { finishOf } from "./shelf";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const item = (name: string, qty: string, from: FridgeItem["from"], extra: Partial<FridgeItem> = {}): FridgeItem =>
  ({ id: crypto.randomUUID(), name: cap(name.trim()), qty: qty.trim(), at: Date.now(), from, ...extra });

// Rangés aux placards (le reste va au frigo) : l'épicerie, le pain, et les légumes qui se gardent dehors
const OUTSIDE = ["pomme", "terre", "patate", "oignon", "echalote", "ail", "banane", "courge", "potiron", "butternut", "citron", "orange", "clementine", "kiwi"];
const COLD = ["creme", "fraiche", "lait", "beurre", "yaourt", "fromage", "oeuf", "jambon", "compote", "jus"];
export function guessPlace(name: string): Place {
  const w = norm(name);
  if (w.some(x => COLD.includes(x)) && !w.includes("conserve")) return "frigo";
  if (["Épicerie", "Boulangerie"].includes(aisleOf(name))) return "placard";
  return w.length && OUTSIDE.includes(w[0]) ? "placard" : "frigo";
}
export const placeOf = (x: FridgeItem): Place => x.place ?? guessPlace(x.name);
/** Ce qu'il y a vraiment dans les placards (pour « Dans tes placards ? »), sans ce que la liste a déjà. */
export const pantryOf = (f: Fridge, without: { name: string }[] = []): { name: string; qty: string }[] =>
  f.items.filter(x => placeOf(x) === "placard" && !without.some(w => same(w.name, x.name))).map(x => ({ name: x.name, qty: qtyOf(x.qty) }));
/** La quantité. « à la main » : l'ancienne façon de marquer un ingrédient tapé, pas une quantité. */
export const qtyOf = (q: string | undefined) => (q === "à la main" ? "" : q ?? "");

/** Ajoute des produits ; déjà là : la quantité et la date sont mises à jour. */
export function addItems(f: Fridge, add: { name: string; qty: string; finish?: boolean }[], from: FridgeItem["from"], extra: Partial<FridgeItem> = {}): Fridge {
  const items = [...f.items];
  for (const a of add) {
    if (!a.name.trim()) continue;
    const i = items.findIndex(x => same(x.name, a.name));
    const next = item(a.name, a.qty, from, { place: guessPlace(a.name), ...extra, ...(a.finish ? { finish: true } : {}) });
    if (i >= 0) items[i] = { ...next, id: items[i].id, qty: a.qty.trim() || items[i].qty, finish: a.finish || items[i].finish || undefined, place: extra.place ?? items[i].place ?? next.place,
      since: items[i].since ?? items[i].at, ...(items[i].until ? { until: items[i].until } : {}) };
    else items.push(next);
  }
  return { ...f, items };
}

/** Le scan est fini. Frigo : ce qui est au frigo est remplacé par ce que la photo a vu. Placards : pareil pour les placards.
 *  Ticket : tout s'ajoute, rangé d'après le nom. */
export function fromScan(f: Fridge, found: DetectedIngredient[], source: ScanSource): Fridge {
  const add = found.map(i => ({ name: i.name, qty: qtyOf(i.qty), finish: i.finish }));
  if (source === "ticket") return addItems(f, add, "scan");
  const place: Place = source === "frigo" ? "frigo" : "placard";
  const kept = { ...f, items: f.items.filter(x => placeOf(x) !== place) };
  const added = addItems(kept, add, "scan", { place });
  // Déjà là avant le scan : il garde le jour où il est entré et sa vraie date (pour les dates de péremption)
  const before = f.items.filter(x => placeOf(x) === place);
  const next = { ...added, items: added.items.map(x => {
    const b = before.find(y => same(y.name, x.name));
    return b && !kept.items.includes(x) ? { ...x, since: b.since ?? b.at, ...(b.until ? { until: b.until } : {}) } : x;
  }) };
  return place === "frigo" ? { ...next, seen: Date.now() } : { ...next, seenPlacard: Date.now() };
}

/** Sans photo (« Que cuisiner avec ? », ingrédients tapés) : rien n'est remplacé. Déjà là : chaque produit garde sa place
 *  et sa date, seuls la quantité et « À finir » suivent la liste vérifiée. Nouveau : ajouté, rangé d'après le nom. */
export function fromList(f: Fridge, found: DetectedIngredient[]): Fridge {
  const known = f.items.map(x => {
    const a = found.find(i => same(i.name, x.name));
    return a ? { ...x, qty: qtyOf(a.qty).trim() || x.qty, finish: a.finish || undefined } : x;
  });
  const fresh = found.filter(i => !f.items.some(x => same(x.name, i.name)));
  return addItems({ ...f, items: known }, fresh.map(i => ({ name: i.name, qty: qtyOf(i.qty), finish: i.finish })), "scan");
}

/** Une course cochée entre dans le frigo ; décochée, elle en sort. Déjà là : les quantités s'additionnent
 *  (300 g + 200 g achetés = 500 g), et décochée, la quantité d'avant revient. */
export function fromShopping(f: Fridge, shop: { id: string; name: string; qty: string; done: boolean }): Fridge {
  if (shop.done) {
    const old = f.items.find(x => same(x.name, shop.name));
    if (!old || old.shopId) return addItems(f, [{ name: shop.name, qty: shop.qty }], "courses", { shopId: shop.id });
    const prev = { qty: old.qty, from: old.from, at: old.at };
    return { ...f, items: f.items.map(x => (x === old ? { ...x, qty: sumQty(x.qty, shop.qty), from: "courses", at: Date.now(), shopId: shop.id, prev } : x)) };
  }
  return { ...f, items: f.items.flatMap(x => (x.shopId !== shop.id ? [x] : x.prev ? [{ ...x, ...x.prev, shopId: undefined, prev: undefined }] : [])) };
}

// Le sel, l'huile, les pâtes : jamais retirés du frigo par une recette
const KEEP = ["sel", "poivre", "eau", "huile", "epice", "farine", "sucre"];

/** Une recette est cuisinée : les produits qu'elle utilise (ceux qu'on avait) sortent du frigo. */
export function cookFrom(f: Fridge, r: GeneratedRecipe): Fridge {
  const used = (r.items?.length ? r.items.filter(i => i.have).map(i => i.name) : (r.recipeIngredients ?? []).map(i => i.name))
    .map(norm).filter(w => w.length && !w.some(x => KEEP.includes(x)));
  // Le premier mot compte (« poivron rouge » et « chou rouge » ne se confondent pas)
  const hit = (x: FridgeItem) => { const w = norm(x.name); return used.some(u => w.includes(u[0]) || (w.length > 0 && u.includes(w[0]))); };
  const gone = f.items.filter(hit);
  if (!gone.length) return f;
  return { ...f, items: f.items.filter(x => !hit(x)), cooked: { title: r.title, items: gone, at: Date.now() } };
}

/** « Remettre » : ce que la dernière recette a retiré revient. */
export function undoCooked(f: Fridge): Fridge {
  if (!f.cooked) return f;
  const back = f.cooked.items.filter(x => !f.items.some(y => same(y.name, x.name)));
  return { ...f, items: [...f.items, ...back], cooked: undefined };
}

/** Les produits à donner au scan (« Que cuisiner avec ? ») */
export const toIngredients = (f: Fridge) => f.items.map(x => ({ name: x.name, qty: qtyOf(x.qty), ...(finishOf(x) ? { finish: true } : {}) }));
