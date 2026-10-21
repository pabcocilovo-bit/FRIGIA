// Premier scan guidé : les bulles, et où on en est (une fois par compte, gardé sur le téléphone).
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
  { target: ".frame", r: 28, pos: "mid", title: "Tout le frigo dans le cadre", text: "Porte grande ouverte, lumière allumée, un pas en arrière. Pas besoin que ce soit parfait." },
  { target: ".shutter", r: 999, pad: 10, pos: "up", title: "Touche le rond", text: "Ou choisis une photo déjà prise, à gauche. Frigia repère tes ingrédients en quelques secondes.", btn: "C'est parti", cam: true },
];
export const INGR_GUIDE: GuideStep[] = [
  { target: ".ilist .irow", r: 16, pos: "down", title: "Vérifie ce qu'on a trouvé", text: "Touche un nom ou une quantité pour le corriger. Ce n'est plus là ? Touche la croix." },
  { target: ".ingr-body > .add", r: 16, pos: "up", title: "Il manque quelque chose ?", text: "Ajoute-le ici. Ensuite, tu choisis ton menu : des plats, un dessert…", btn: "Compris" },
];
