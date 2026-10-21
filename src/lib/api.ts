// Appels aux fonctions serveur (/api/*) avec le jeton de la session Supabase.
import { supabase } from "../supabase";

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
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
