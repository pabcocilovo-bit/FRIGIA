// Compteur de la communauté : les kilos sauvés par tous les foyers Frigia (fonction community_saved, migration 20261019000000).
// Deux totaux seulement, rien sur les comptes. Sans la fonction ou hors ligne : pas de compteur.
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export type Community = { kg: number; households: number };

/** En dessous, le compteur ne s'affiche pas : « 0 kg sauvés par la communauté » dessert l'appli */
export const COMMUNITY_MIN_KG = 1;
const FRESH_MS = 60_000;

let last: { at: number; value: Community | null } | null = null;
let pending: Promise<Community | null> | null = null;

async function fetchCommunity(): Promise<Community | null> {
  const { data, error } = await supabase.rpc("community_saved");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return null;
  return { kg: Number(row.kg) || 0, households: Number(row.households) || 0 };
}

export function useCommunity(): Community | null {
  const [value, setValue] = useState<Community | null>(last?.value ?? null);
  useEffect(() => {
    if (last && Date.now() - last.at < FRESH_MS) return;
    let on = true;
    pending ??= fetchCommunity().then(v => { last = { at: Date.now(), value: v }; pending = null; return v; });
    void pending.then(v => { if (on) setValue(v); });
    return () => { on = false; };
  }, []);
  return value && value.kg >= COMMUNITY_MIN_KG ? value : null;
}

/** « 12 480 » (espace fine), « 3,4 » sous 10 kg */
export const cmFmt = (v: number) => (v < 10 ? String(Math.floor(v * 10) / 10).replace(".", ",") : Math.floor(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "));
