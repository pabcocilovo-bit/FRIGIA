// L'appli en français ou en anglais (Hugo, 4 novembre). Par défaut, la langue du téléphone : le français si elle
// commence par « fr », l'anglais sinon. Le choix des Réglages l'emporte, gardé dans le navigateur.
// Chaque texte s'écrit sur place dans les deux langues : t("Vider la liste", "Clear the list"). Changer de langue
// recharge l'appli, la langue ne bouge donc pas pendant qu'elle tourne.
export type Lang = "fr" | "en";

const KEY = "frigia_lang";
/** Tant que la traduction n'est pas finie, l'anglais ne vient que d'un choix explicite (?lang=en, ou les Réglages
 *  sur la préversion) : un téléphone en anglais garde le français. À passer à true quand tout est traduit. */
export const AUTO_LANG = false;

function read(): Lang {
  try {
    const asked = typeof location !== "undefined" ? new URLSearchParams(location.search).get("lang") : null;
    if (asked === "fr" || asked === "en") localStorage.setItem(KEY, asked);
    const saved = localStorage.getItem(KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch { /* stockage bloqué : la langue du téléphone */ }
  if (!AUTO_LANG) return "fr";
  const nav = typeof navigator !== "undefined" ? navigator.languages?.[0] ?? navigator.language : "fr";
  return !nav || nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export const lang: Lang = read();
export const isEn = lang === "en";
/** Pour les dates et les nombres : « 4 novembre » ou « November 4 » */
export const locale = isEn ? "en-GB" : "fr-FR";

if (typeof document !== "undefined") document.documentElement.lang = lang;

/** Le texte dans la langue de l'appli. Marche aussi avec du JSX : t(<>Tes <em>réglages</em></>, <>Your <em>settings</em></>). */
export function t<A, B = A>(fr: A, en: B): A | B {
  return isEn ? en : fr;
}

/** Choisir la langue (Réglages) : on la garde, puis on recharge. */
export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* tant pis, la langue du téléphone */ }
  if (l !== lang) window.location.reload();
}

/** « 1 article », « 3 articles » / « 1 item », « 3 items » */
export function plural(n: number, fr: string, en: string, frMany = fr + "s", enMany = en + "s"): string {
  return `${n} ${n > 1 || (isEn && n === 0) ? t(frMany, enMany) : t(fr, en)}`;
}
