// Premier scan guidé : les bulles, et où on en est (une fois par compte, gardé sur le téléphone).
import { t } from "../../lib/i18n";
export type GuideStep = {
  /** Sélecteur de l'élément à montrer, dans l'écran */
  target: string;
  /** Arrondi du trou (999 : pilule) */
  r: number;
  pad?: number;
  pos: "down" | "up" | "mid";
  title: string;
  text: string;
  /** Texte du bouton de la dernière bulle (« Suivant » sinon) ; cam : avec l'icône appareil photo */
  btn?: string;
  cam?: boolean;
};

const KEY = (userId: string) => `frigia_guide_${userId}`;
/** Où en est le guide : rien (jamais vu), "ingr" (caméra faite, reste « C'est bien ça ? »), "done". */
export function guideState(userId: string): "" | "ingr" | "done" {
  try { const v = localStorage.getItem(KEY(userId)); return v === "ingr" || v === "done" ? v : ""; } catch { return "done"; }
}
export function setGuideState(userId: string, v: "ingr" | "done") {
  try { localStorage.setItem(KEY(userId), v); } catch { /* navigation privée */ }
}

export const SCAN_GUIDE: GuideStep[] = [
  { target: ".frame", r: 28, pos: "mid", title: t("Tout le frigo dans le cadre", "The whole fridge in the frame"),
    text: t("Porte grande ouverte, lumière allumée, un pas en arrière. Pas besoin que ce soit parfait.", "Door wide open, light on, one step back. It doesn't need to be perfect.") },
  { target: ".shutter", r: 999, pad: 10, pos: "up", title: t("Touche le rond", "Tap the circle"),
    text: t("Ou choisis une photo déjà prise, à gauche. Frigia repère tes ingrédients en quelques secondes.", "Or pick a photo you've already taken, on the left. Frigia spots your ingredients in a few seconds."),
    btn: t("C'est parti", "Let's go"), cam: true },
];
export const INGR_GUIDE: GuideStep[] = [
  { target: ".ilist .irow", r: 16, pos: "down", title: t("Vérifie ce qu'on a trouvé", "Check what we found"),
    text: t("Touche un nom ou une quantité pour le corriger. Ce n'est plus là ? Touche la croix.", "Tap a name or a quantity to fix it. Not there anymore? Tap the cross.") },
  { target: ".ingr-body > .add", r: 16, pos: "up", title: t("Il manque quelque chose ?", "Something missing?"),
    text: t("Ajoute-le ici. Ensuite, tu choisis ton menu : des plats, un dessert…", "Add it here. Then you pick your menu: mains, a dessert…"), btn: t("Compris", "Got it") },
];
