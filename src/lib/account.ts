// Compte : données gardées sur le téléphone, profil, mot de passe, suppression.
import { supabase } from "../supabase";
import type { Prefs, User } from "./types";
import { postApi } from "./api";

const key = (name: string, userId: string) => `frigia_${name}_${userId}`;

export function getPrefs(userId: string): Prefs | null {
  return JSON.parse(localStorage.getItem(key("prefs", userId)) || "null");
}
export function setPrefs(userId: string, prefs: Prefs) {
  localStorage.setItem(key("prefs", userId), JSON.stringify(prefs));
}

export const getAvatar = (userId: string) => localStorage.getItem(key("avatar", userId));
export const setAvatar = (userId: string, dataUrl: string) => localStorage.setItem(key("avatar", userId), dataUrl);

/** Efface tout ce que Frigia garde sur ce téléphone. */
export function clearLocalData() {
  Object.keys(localStorage).filter(k => k.startsWith("frigia_")).forEach(k => localStorage.removeItem(k));
}

/** Le compte n'a pas de mot de passe (connexion Google…). */
export const isOAuthUser = (u: User | null | undefined) => !u?.identities?.some(i => i.provider === "email");

export const displayName = (u: User | null | undefined): string =>
  u?.user_metadata?.full_name || u?.user_metadata?.name || "";

export function updateProfile(u: User | null, profile: { name: string; email: string; phone: string; bio: string }) {
  const emailChanged = !!profile.email && profile.email !== u?.email;
  return supabase.auth.updateUser({
    data: { full_name: profile.name, phone: profile.phone, bio: profile.bio },
    ...(emailChanged ? { email: profile.email } : {}),
  }).then(({ error }) => ({ error, emailChanged }));
}

/** Vérifie le mot de passe actuel (comptes email) puis le remplace. */
export async function changePassword(u: User | null, current: string, next: string): Promise<"wrong-current" | { error: string } | "ok"> {
  if (!isOAuthUser(u) && current) {
    const { error } = await supabase.auth.signInWithPassword({ email: u?.email || "", password: current });
    if (error) return "wrong-current";
  }
  const { error } = await supabase.auth.updateUser({ password: next });
  return error ? { error: error.message } : "ok";
}

/** Supprime le compte côté serveur. Lève une erreur avec le message à afficher. */
export async function deleteAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Non authentifié");
  const res = await postApi("/api/delete-account");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur serveur");
}

export const signOut = () => supabase.auth.signOut();
