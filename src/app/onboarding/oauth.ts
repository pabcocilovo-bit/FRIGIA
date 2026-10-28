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
