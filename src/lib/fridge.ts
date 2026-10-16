// Mon frigo : ce qu'il y a dedans, sans rien taper.
// Un scan du frigo le remplace (la photo montre ce qu'il y a maintenant) ; un scan du placard ou d'un ticket s'y ajoute.
// Une course cochée y entre (décochée, elle en sort). Une recette cuisinée retire ce qu'elle a pris, et « Remettre » annule.
import type { DetectedIngredient, GeneratedRecipe } from "./types";
import type { Fridge, FridgeItem } from "./home";
import { norm, same } from "./shopping";
import type { ScanSource } from "./scan";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const item = (name: string, qty: string, from: FridgeItem["from"], extra: Partial<FridgeItem> = {}): FridgeItem =>
  ({ id: crypto.randomUUID(), name: cap(name.trim()), qty: qty.trim(), at: Date.now(), from, ...extra });

/** Ajoute des produits ; déjà là : la quantité et la date sont mises à jour. */
export function addItems(f: Fridge, add: { name: string; qty: string; finish?: boolean }[], from: FridgeItem["from"], extra: Partial<FridgeItem> = {}): Fridge {
  const items = [...f.items];
  for (const a of add) {
    if (!a.name.trim()) continue;
    const i = items.findIndex(x => same(x.name, a.name));
    const next = item(a.name, a.qty, from, { ...extra, ...(a.finish ? { finish: true } : {}) });
    if (i >= 0) items[i] = { ...next, id: items[i].id, qty: a.qty.trim() || items[i].qty, finish: a.finish || items[i].finish || undefined };
    else items.push(next);
  }
  return { ...f, items };
}

/** Le scan est fini : le frigo prend ce que la photo a vu (frigo), ou l'ajoute (placard, ticket). */
export function fromScan(f: Fridge, found: DetectedIngredient[], source: ScanSource): Fridge {
  const add = found.map(i => ({ name: i.name, qty: i.qty ?? "", finish: i.finish }));
  if (source !== "frigo") return addItems(f, add, "scan");
  return { ...addItems({ items: [], seen: null }, add, "scan"), seen: Date.now() };
}

/** Une course cochée entre dans le frigo ; décochée, elle en sort. */
export function fromShopping(f: Fridge, shop: { id: string; name: string; qty: string; done: boolean }): Fridge {
  if (shop.done) return addItems(f, [{ name: shop.name, qty: shop.qty }], "courses", { shopId: shop.id });
  return { ...f, items: f.items.filter(x => x.shopId !== shop.id) };
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
  return { items: [...f.items, ...back], seen: f.seen };
}

/** Les produits à donner au scan (« Que cuisiner avec ? ») */
export const toIngredients = (f: Fridge) => f.items.map(x => ({ name: x.name, qty: x.qty, ...(x.finish ? { finish: true } : {}) }));
