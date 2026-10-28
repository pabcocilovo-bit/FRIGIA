// Famille, semaine, courses (étape 10), frigo et budget : une copie sur le téléphone + la table Supabase home_data (une ligne par compte).
// Chaque partie (members, week, shopping) s'enregistre de son côté. Sans la table (migration 20261018000000_home_data.sql
// pas encore lancée) ou hors ligne, la partie reste sur le téléphone et part sur le compte au prochain chargement qui réussit.
import { supabase } from "../supabase";
import type { GeneratedRecipe } from "./types";
import { type Budget, cleanBudget, EMPTY_BUDGET } from "./budget";

/** Un proche du foyer. Toi : id « me » (ton prénom et tes allergies viennent du compte, on garde ici ce que tu n'aimes pas et ton appétit).
 *  appetite : de 1 (petit appétit) à 5 (gros mangeur) ; absent, il dépend de l'âge (voir appetiteOf). */
export type Member = { id: string; name: string; kid: boolean; age: number; allergies: string[]; dislikes: string[]; appetite?: number };
export const ME = "me";

/** Un repas prévu : la recette (copie), d'où elle vient, et si ce sont les restes de la veille. */
export type Slot = { recipe: GeneratedRecipe; scanId: string | null; n: number | null; left?: boolean };
export type MealKey = "m" | "s";
/** md, sd : le dessert du midi, du soir (en plus du plat) */
export type PlanDay = { off?: boolean; m?: Slot; s?: Slot; md?: Slot; sd?: Slot };
/** La semaine : jours à venir (« 2026-10-14 »), et si les midis sont prévus aussi. */
export type Week = { midi: boolean; days: Record<string, PlanDay> };

/** Un article de la liste : rangé par rayon, avec la recette (et le jour) qui le demande. */
export type ShopItem = { id: string; name: string; qty: string; aisle: string; from: string; done: boolean; at: number };

/** Un produit de Ma cuisine. from : vu au scan, acheté (course cochée, shopId) ou ajouté à la main. finish : « À finir ».
 *  place : dans le frigo ou les placards (absent : deviné d'après le nom, voir placeOf). */
export type Place = "frigo" | "placard";
export type FridgeItem = { id: string; name: string; qty: string; at: number; from: "scan" | "courses" | "main"; finish?: boolean; shopId?: string; place?: Place;
  /** Dates de péremption (lib/shelf.ts) : entré dans Ma cuisine (absent : at ; un nouveau scan ne le change pas), et la vraie date si on l'a mise.
   *  finish === false : « À finir » décoché à la main (sinon il se coche tout seul à 2 jours de la date) */
  since?: number; until?: number;
  /** Une course cochée s'est ajoutée à ce qu'on avait déjà : la quantité d'avant, remise si on la décoche */
  prev?: { qty: string; from: FridgeItem["from"]; at: number } };
/** Ma cuisine (colonne fridge) : les produits, la date du dernier scan du frigo (seen) et des placards (seenPlacard),
 *  la dernière recette cuisinée (ce qu'elle a retiré, pour « Remettre ») et les ingrédients tapés à la main
 *  qui n'étaient pas dans la liste (mine), proposés aux prochains ajouts. */
export type Fridge = { items: FridgeItem[]; seen: number | null; seenPlacard?: number; cooked?: { title: string; items: FridgeItem[]; at: number }; mine?: string[] };
export const EMPTY_FRIDGE: Fridge = { items: [], seen: null };

export type Home = { members: Member[]; week: Week; shopping: ShopItem[]; fridge: Fridge; budget: Budget };
export type Part = keyof Home;
export const EMPTY_HOME: Home = { members: [], week: { midi: true, days: {} }, shopping: [], fridge: EMPTY_FRIDGE, budget: EMPTY_BUDGET };

type Cached = Home & { pending: Part[] };
const key = (userId: string) => `frigia_home_${userId}`;

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Les jours passés ne servent plus */
function prune(w: Week, today = dayKey(new Date())): Week {
  const days = Object.fromEntries(Object.entries(w.days ?? {}).filter(([d]) => d >= today));
  return { midi: w.midi !== false, days };
}

const clean = (h: Partial<Home>): Home => ({
  members: Array.isArray(h.members) ? h.members : [],
  week: prune(h.week && typeof h.week === "object" ? h.week : EMPTY_HOME.week),
  shopping: Array.isArray(h.shopping) ? h.shopping : [],
  fridge: h.fridge && typeof h.fridge === "object" && Array.isArray(h.fridge.items)
    ? { items: h.fridge.items, seen: typeof h.fridge.seen === "number" ? h.fridge.seen : null,
      ...(typeof h.fridge.seenPlacard === "number" ? { seenPlacard: h.fridge.seenPlacard } : {}), ...(h.fridge.cooked ? { cooked: h.fridge.cooked } : {}),
      ...(Array.isArray(h.fridge.mine) ? { mine: h.fridge.mine.filter((x): x is string => typeof x === "string") } : {}) }
    : EMPTY_FRIDGE,
  budget: cleanBudget(h.budget),
});

function getCached(userId: string): Cached {
  try {
    const c = JSON.parse(localStorage.getItem(key(userId)) || "null") as Cached | null;
    return c ? { ...clean(c), pending: c.pending ?? [] } : { ...EMPTY_HOME, pending: [] };
  } catch { return { ...EMPTY_HOME, pending: [] }; }
}
function setCached(userId: string, c: Cached) {
  try { localStorage.setItem(key(userId), JSON.stringify(c)); } catch { /* navigation privée */ }
}

/** Garde une partie sur le téléphone, marquée « pas encore sur le compte ». */
export function cachePart<P extends Part>(userId: string, part: P, value: Home[P]) {
  const c = getCached(userId);
  setCached(userId, { ...c, [part]: value, pending: c.pending.includes(part) ? c.pending : [...c.pending, part] });
}

/** Envoie une partie sur le compte. true : elle y est. */
export async function sendPart<P extends Part>(userId: string, part: P, value: Home[P]): Promise<boolean> {
  const { error } = await supabase.from("home_data").upsert({ user_id: userId, [part]: value, updated_at: new Date().toISOString() });
  if (error) return false;
  const c = getCached(userId);
  // Seulement si rien n'a changé entre-temps
  if (JSON.stringify(c[part]) === JSON.stringify(value)) setCached(userId, { ...c, pending: c.pending.filter(p => p !== part) });
  return true;
}

/** La copie du téléphone d'abord (onCached), puis le compte (onLoaded). Les parties pas encore envoyées gagnent. */
export async function loadHome(userId: string, onCached: (h: Home) => void, onLoaded: (h: Home) => void) {
  const cached = getCached(userId);
  onCached(clean(cached));
  const { data, error } = await supabase.from("home_data").select("members, week, shopping").eq("user_id", userId).maybeSingle();
  if (error) return;
  // Le frigo à part : sans la colonne (migration 20261023000000_fridge.sql pas encore lancée), il reste sur le téléphone
  const fr = await supabase.from("home_data").select("fridge").eq("user_id", userId).maybeSingle();
  // Le budget aussi (migration 20261027000000_budget.sql)
  const bu = await supabase.from("home_data").select("budget").eq("user_id", userId).maybeSingle();
  const remote = data ? clean({ ...(data as Partial<Home>), fridge: (fr.data as Partial<Home> | null)?.fridge, budget: (bu.data as Partial<Home> | null)?.budget }) : EMPTY_HOME;
  const merged: Home = {
    members: cached.pending.includes("members") ? cached.members : remote.members,
    week: cached.pending.includes("week") ? cached.week : remote.week,
    shopping: cached.pending.includes("shopping") ? cached.shopping : remote.shopping,
    fridge: cached.pending.includes("fridge") || fr.error ? cached.fridge : remote.fridge,
    budget: cached.pending.includes("budget") || bu.error ? cached.budget : remote.budget,
  };
  setCached(userId, { ...merged, pending: cached.pending });
  onLoaded(merged);
  await Promise.all(cached.pending.map(p => sendPart(userId, p, merged[p])));
}

export const clearHomeCache = (userId: string) => { try { localStorage.removeItem(key(userId)); } catch { /* rien */ } };
