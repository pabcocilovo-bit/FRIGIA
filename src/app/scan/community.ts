// Les ingrédients de la communauté (migration 20261025000000) : un mot tapé à la main, absent de la liste, part sur le compte
// (une fois par compte). Ceux tapés par au moins 3 comptes reviennent à tout le monde dans « Ajouter ».
// Sans la migration ou hors ligne : rien ne part, et la dernière liste reçue reste sur le téléphone.
import { supabase } from "../../supabase";
import { norm as words } from "../../lib/shopping";

const KEY = "frigia_community_ingredients";
let last: string[] | null = null;
let pending: Promise<string[]> | null = null;

const cached = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
};

/** La liste de la communauté : celle du téléphone tout de suite (onCached), puis celle du compte. */
export function communityIngredients(onCached: (names: string[]) => void): Promise<string[]> {
  if (last) return Promise.resolve(last);
  onCached(cached());
  pending ??= (async () => {
    const { data, error } = await supabase.rpc("community_ingredients");
    pending = null;
    if (error || !Array.isArray(data)) return cached();
    const names = (data as { name: unknown }[]).map(r => r.name).filter((x): x is string => typeof x === "string");
    last = names;
    try { localStorage.setItem(KEY, JSON.stringify(names)); } catch { /* navigation privée */ }
    return names;
  })();
  return pending;
}

/** Compte les mots tapés à la main (une ligne par compte et par mot, l'erreur est ignorée). */
export function shareTyped(names: string[]) {
  const rows = names.map(n => ({ key: words(n).join(" ").slice(0, 40), name: n.trim().slice(0, 40) }))
    .filter(r => r.key.length >= 2 && r.name.length >= 2);
  if (!rows.length) return;
  void supabase.from("ingredient_typed").upsert(rows, { onConflict: "user_id,key", ignoreDuplicates: true }).then(() => undefined, () => undefined);
}
