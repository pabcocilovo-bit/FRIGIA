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

// ─── Photo de profil : gardée sur le téléphone et sur le compte (profiles.avatar) ───
export const getAvatar = (userId: string) => localStorage.getItem(key("avatar", userId));
const keepAvatar = (userId: string, src: string | null) => {
  try {
    if (src) localStorage.setItem(key("avatar", userId), src);
    else localStorage.removeItem(key("avatar", userId));
  } catch { /* téléphone plein : la photo reste sur le compte */ }
};

/** Photo enregistrée sur le compte. undefined : la base n'a pas répondu (ou la colonne n'existe pas encore). */
export async function fetchAvatar(userId: string): Promise<string | null | undefined> {
  const { data, error } = await supabase.from("profiles").select("avatar").eq("id", userId).maybeSingle();
  if (error) return undefined;
  const src = (data?.avatar as string | null | undefined) ?? null;
  if (src) keepAvatar(userId, src);
  return src;
}

/** Change (ou retire, avec null) la photo du compte. Renvoie false si la base n'a pas pu l'enregistrer. */
export async function saveAvatar(userId: string, src: string | null): Promise<boolean> {
  keepAvatar(userId, src);
  const { error } = await supabase.from("profiles").update({ avatar: src }).eq("id", userId);
  return !error;
}

/** Une photo choisie sur le téléphone, recadrée en carré de 256 px (assez pour un rond, légère à garder). */
export function squarePhoto(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Cette photo ne s'ouvre pas")); };
    img.src = url;
  });
}

/** Efface tout ce que Frigia garde sur ce téléphone. */
export function clearLocalData() {
  Object.keys(localStorage).filter(k => k.startsWith("frigia_")).forEach(k => localStorage.removeItem(k));
}

/** Le compte n'a pas de mot de passe (connexion Google…). */
export const isOAuthUser = (u: User | null | undefined) => !u?.identities?.some(i => i.provider === "email");

export const displayName = (u: User | null | undefined): string =>
  u?.user_metadata?.full_name || u?.user_metadata?.name || "";

/** Vérifie le mot de passe actuel (comptes email) puis le remplace. Les autres appareils sont déconnectés. */
export async function changePassword(u: User | null, current: string, next: string): Promise<"wrong-current" | { error: string } | "ok"> {
  if (!isOAuthUser(u) && current) {
    const { error } = await supabase.auth.signInWithPassword({ email: u?.email || "", password: current });
    if (error) return "wrong-current";
  }
  const { error } = await supabase.auth.updateUser({ password: next, data: { pw_changed_at: new Date().toISOString() } });
  if (error) return { error: error.message };
  await supabase.auth.signOut({ scope: "others" });
  return "ok";
}

/** Date du dernier changement de mot de passe fait dans l'appli (inconnue pour les anciens comptes). */
export const passwordChangedAt = (u: User): Date | null =>
  u.user_metadata?.pw_changed_at ? new Date(u.user_metadata.pw_changed_at) : null;

// ─── Email changé par code : un code à 6 chiffres part à la nouvelle adresse ───
export async function startEmailChange(email: string) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}
export async function confirmEmailChange(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email_change" });
  if (error) throw error;
}

// ─── Google relié au compte (Supabase : « Manual linking » activé) ───
export const hasGoogle = (u: User) => !!u.identities?.some(i => i.provider === "google");
export async function linkGoogle() {
  const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: `${window.location.origin}/reglages/compte` } });
  if (error) throw error;
}
/** Retire Google. Refusé par Supabase si c'est la seule façon d'entrer dans le compte. */
export async function unlinkGoogle() {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  const google = data.identities.find(i => i.provider === "google");
  if (!google) return;
  const res = await supabase.auth.unlinkIdentity(google);
  if (res.error) throw res.error;
  await supabase.auth.refreshSession();
}

/** Télécharge tout ce que Frigia garde sur le compte, dans un fichier JSON. */
export async function downloadMyData(u: User) {
  const [profile, history, favorites] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
    supabase.from("user_history").select("*").eq("user_id", u.id),
    supabase.from("user_favorites").select("*").eq("user_id", u.id),
  ]);
  const failed = [profile, history, favorites].find(r => r.error);
  if (failed?.error) throw failed.error;
  const data = {
    exporte_le: new Date().toISOString(),
    compte: { email: u.email, cree_le: u.created_at, connexions: u.identities?.map(i => i.provider) ?? [] },
    profil: profile.data,
    scans: history.data,
    favoris: favorites.data,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "frigia-mes-donnees.json" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** « Nous écrire », « Signaler un problème », « Donner ton avis » : le message arrive dans la table support_messages. */
export async function sendSupportMessage(u: User, kind: "contact" | "bug" | "idea", topic: string, message: string, appInfo?: string) {
  const { error } = await supabase.from("support_messages").insert({
    user_id: u.id, email: u.email ?? null, kind, topic, message, app_info: appInfo ?? null,
  });
  if (error) throw error;
}

/** Supprime le compte côté serveur. Lève une erreur avec le message à afficher. */
export async function deleteAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Non authentifié");
  const res = await postApi("/api/delete-account");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur serveur");
}

/** Déconnecte. « local » : seulement ce téléphone, sans demander au serveur (compte déjà supprimé). */
export const signOut = (scope?: "local") => supabase.auth.signOut(scope ? { scope } : undefined);
