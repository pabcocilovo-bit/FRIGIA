// Repérage du navigateur, repris de l'ancienne landing.

export type InApp = { isGoogleApp: boolean; isSocialApp: boolean; isIos: boolean; isAndroid: boolean };

// Vide pendant le pré-rendu (Node), où il n'y a pas de navigateur
const userAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

export const isAndroid = () => /android/i.test(userAgent());

export function detectInAppBrowser(): InApp {
  const ua = userAgent();
  return {
    isIos: /iphone|ipad|ipod/i.test(ua),
    isAndroid: /android/i.test(ua),
    isGoogleApp: /GSA\//i.test(ua),
    isSocialApp: /Instagram|FBAN|FBAV|FB_IAB|Snapchat|BytedanceWebview|musical_ly|TikTok|Twitter\/|Pinterest\/|LinkedInApp/i.test(ua),
  };
}

export function openInNativeBrowser(isIos: boolean) {
  window.location.href = isIos
    ? "x-safari-https://frigia.fr"
    : "intent://frigia.fr/#Intent;scheme=https;package=com.android.chrome;end";
}

export type Browser = "ios-safari" | "ios-chrome" | "chrome-android" | "chrome-desktop" | "samsung" | "firefox-android" | "edge-mobile" | "unknown";

export function detectBrowser(): Browser {
  const ua = userAgent();
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isEdge = /edg\//i.test(ua);
  const isChrome = /chrome/i.test(ua) && !isEdge;
  if (isIos && /CriOS/i.test(ua)) return "ios-chrome";
  if (isIos) return "ios-safari";
  if (isAndroid && /samsungbrowser/i.test(ua)) return "samsung";
  if (isAndroid && /firefox/i.test(ua)) return "firefox-android";
  if (isAndroid && isEdge) return "edge-mobile";
  if (isAndroid && isChrome) return "chrome-android";
  if (isChrome) return "chrome-desktop";
  return "unknown";
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Événement d'installation de Chrome (absent des types DOM standard)
export type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
