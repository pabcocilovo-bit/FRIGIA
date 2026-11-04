// Appels aux fonctions serveur (/api/*) avec le jeton de la session Supabase.
import { supabase } from "../supabase";
import { lang } from "./i18n";

/** La langue de l'appli, pour les réponses du serveur (recettes de l'IA, messages, emails) */
export const LANG_HEADER = { "X-Frigia-Lang": lang };

export async function accessToken(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

/** POST authentifié vers une route /api. Renvoie la réponse brute. */
export async function postApi(path: string, body?: unknown): Promise<Response> {
  const token = await accessToken();
  return fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...LANG_HEADER,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
