// L'appli tourne dans l'app mobile (Capacitor) ou dans un navigateur.
// Dans l'app, les pages sont servies depuis le téléphone (https://localhost ou capacitor://localhost) :
// les appels /api et les liens à partager doivent viser le vrai site.
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export const isNativeApp = Capacitor.isNativePlatform();

/** Adresse du site public : celle de la page dans un navigateur, frigia.fr dans l'app. */
export const SITE_ORIGIN = isNativeApp || typeof window === "undefined" ? "https://frigia.fr" : window.location.origin;

/** Réglages propres à l'app mobile. À appeler une fois, au démarrage. */
export function setupNativeApp() {
  if (!isNativeApp) return;
  routeApiToSite();
  // Android : le bouton retour revient à l'écran précédent, et ferme l'app depuis l'accueil
  void App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back(); else void App.exitApp();
  });
}

/** Dans l'app : envoie les fetch("/api/…") vers frigia.fr. */
function routeApiToSite() {
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/")) input = SITE_ORIGIN + input;
    return original(input, init);
  };
}
