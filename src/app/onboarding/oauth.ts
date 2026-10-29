// Connexion avec Google (Supabase). Après le passage par Google, l'appli dit bonjour au retour (voir App : onSignedIn).
import { supabase } from "../../supabase";
import { showToast } from "../toast";
import { authMessage } from "./errors";

const OAUTH = "frigia_oauth";
export function takeOAuthIntent(): "login" | "signup" | null {
  try { const v = localStorage.getItem(OAUTH); localStorage.removeItem(OAUTH); return v === "login" || v === "signup" ? v : null; } catch { return null; }
}
export async function withGoogle(intent: "login" | "signup") {
  try { localStorage.setItem(OAUTH, intent); } catch { /* rien */ }
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  if (error) showToast(authMessage(error));
}

/** Retour de Google avec une erreur (?error_description=… ou #error_description=…) : compte refusé par la base, par exemple.
 *  Lue au chargement, avant que Supabase ne lise l'adresse. Le message une fois, et l'adresse nettoyée. */
const read = (q: string) => new URLSearchParams(q.replace(/^[#?]/, "")).get("error_description");
let returned = typeof window === "undefined" ? null : read(window.location.search) ?? read(window.location.hash);
export function oauthError(): string | null {
  if (!returned) return null;
  const raw = returned;
  returned = null;
  try { localStorage.removeItem(OAUTH); } catch { /* rien */ }
  window.history.replaceState(null, "", window.location.pathname);
  return authMessage({ message: raw });
}
