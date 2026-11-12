// Connexion avec Google ou Apple (Supabase). Après le passage par Google, l'appli dit bonjour au retour (voir App : onSignedIn).
import type { Provider } from "@supabase/supabase-js";
import { App as NativeApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "../../supabase";
import { isNativeApp } from "../../lib/native";
import { showToast } from "../toast";
import { authMessage } from "./errors";

const OAUTH = "frigia_oauth";
export function takeOAuthIntent(): "login" | "signup" | null {
  try { const v = localStorage.getItem(OAUTH); localStorage.removeItem(OAUTH); return v === "login" || v === "signup" ? v : null; } catch { return null; }
}
export const withGoogle = (intent: "login" | "signup") => withProvider("google", intent);
export const withApple = (intent: "login" | "signup") => withProvider("apple", intent);

async function withProvider(provider: Provider, intent: "login" | "signup") {
  try { localStorage.setItem(OAUTH, intent); } catch { /* rien */ }
  if (isNativeApp) {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: APP_CALLBACK, skipBrowserRedirect: true } });
    if (error) showToast(authMessage(error)); else if (data.url) await Browser.open({ url: data.url });
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  if (error) showToast(authMessage(error));
}

// ─── App mobile ───
// Google refuse les connexions dans une app emballée : on passe par le navigateur du téléphone (Safari, Chrome),
// qui revient dans l'app par cette adresse. À ajouter dans Supabase : Authentication › URL Configuration › Redirect URLs.
export const APP_CALLBACK = "fr.frigia.app://auth";

/** Ouvre une page de connexion (Google, Apple) dans le navigateur du téléphone. */
export const openInBrowser = (url: string) => Browser.open({ url });

/** Retour du navigateur dans l'app : la session est dans l'adresse. À appeler une fois, au démarrage. */
export function listenNativeOAuth() {
  if (!isNativeApp) return;
  void NativeApp.addListener("appUrlOpen", ({ url }) => {
    if (!url.startsWith(APP_CALLBACK)) return;
    void Browser.close().catch(() => { /* déjà fermé */ });
    const u = new URL(url.replace(APP_CALLBACK, "https://app.invalid/"));
    const p = new URLSearchParams(u.hash.slice(1) || u.search.slice(1));
    const err = p.get("error_description");
    if (err) { try { localStorage.removeItem(OAUTH); } catch { /* rien */ } showToast(authMessage({ message: err })); return; }
    const access_token = p.get("access_token"), refresh_token = p.get("refresh_token"), code = p.get("code");
    const done = access_token && refresh_token
      ? supabase.auth.setSession({ access_token, refresh_token })
      : code ? supabase.auth.exchangeCodeForSession(code) : null;
    void done?.then(({ error }) => { if (error) showToast(authMessage(error)); });
  });
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
