// ─────────────────────────────────────────────────────────────
//  RÉGLAGES DE LA LANDING 3D
//  Tout ce qui se règle (couleurs, positions, durées) est ici.
//  Unités : mètres pour la 3D, degrés pour les angles,
//  "unités de timeline" pour les durées (voir SCROLL.ecransParUnite).
// ─────────────────────────────────────────────────────────────

// Couleurs Frigia (reprises de l'appli)
export const COULEURS = {
  creme: '#F5EFE3', // fond de page et de la scène
  papier: '#FBF7EF', // laque du frigo
  interieur: '#EFE7D8', // intérieur du frigo, un ton plus chaud
  sauge: '#527659', // poignée, détails
  saugeClaire: '#9FCCA4', // coins du viseur
  saugeProfonde: '#34503B', // coque du téléphone
  verre: '#DCE5D5', // clayettes et bac
  ambre: '#E0A44A', // touche rare
  ombre: '#3B3326', // teinte de l'ombre cuite au sol
  // Couleurs des aliments posés dans le frigo
  tomate: '#D9573B',
  carotte: '#E8893B',
  fromage: '#EBC662',
  courgette: '#5E9A6C',
  lait: '#FFFDF8',
}

// Longueur du scroll et comportement
export const SCROLL = {
  ecransParUnite: 1.1, // 1 unité de timeline = 1,1 hauteur d'écran de scroll
  scrub: 1, // secondes de "rattrapage" : plus c'est grand, plus c'est souple
  marqueurs: false, // true pour voir les repères ScrollTrigger pendant les réglages
}

// Durées des scènes (en unités de timeline)
export const SCENES = {
  s1: {
    duree: 1.4,
    entreeTelephone: [0, 0.55], // début, fin de l'entrée du téléphone
    miseAuPoint: [0.6, 0.85], // les coins du viseur se resserrent
    flash: 0.95, // instant du flash (la photo est prise)
    flashMontee: 0.03, // le flash s'allume
    flashDescente: 0.2, // puis s'éteint
    sortieTexte: [0.9, 1.25], // le titre s'efface
  },
}

// Caméra principale
export const CAMERA = {
  fov: 50,
  proche: 0.02,
  loin: 30,
  // Pose de départ, par-dessus l'épaule de la personne qui tient le téléphone
  epaule: { position: [0.78, 1.28, 3.05], cible: [0.05, 0.92, 0.3] },
  // Légère avancée pendant la scène 1
  epauleFin: { position: [0.72, 1.25, 2.95], cible: [0.05, 0.92, 0.3] },
}

// Cadrage : décale le sujet pour laisser la place au texte HTML.
// x, y en fraction de la largeur / hauteur de l'écran.
export const CADRAGE = {
  bureau: { x: 0.2, y: 0.0 }, // sujet à droite, texte à gauche
  mobile: { x: 0.0, y: 0.1, fov: 62 }, // sujet en bas, texte en haut, champ plus large
  seuilMobile: 820, // largeur (px) sous laquelle on passe en cadrage mobile
}

// Le téléphone
export const TELEPHONE = {
  largeur: 0.078,
  hauteur: 0.162,
  epaisseur: 0.009,
  rayon: 0.011,
  bordEcran: 0.0035, // marge entre le bord de la coque et l'écran
  // Pose finale, face au frigo
  position: [0.6, 1.1, 2.55],
  rotation: [-0.07, 0.27, 0.02], // radians (ordre YXZ) : tourné vers le frigo, légèrement penché
  // Pose de départ (il entre par le bas)
  departDecalage: [0.05, -0.2, 0.08],
  departRotation: [-0.6, 0.45, 0.14],
  // Balancement "tenu à la main" (s'arrête au flash)
  balancement: { amplitude: 0.0025, vitesse: 0.9 },
  // L'appareil photo du téléphone
  photo: {
    fov: 70, // angle vertical, comme un grand-angle de smartphone
    resolution: 900, // hauteur en pixels de l'image affichée sur l'écran
  },
}

// Le frigo (formes simples en attendant le vrai modèle)
export const FRIGO = {
  largeur: 0.7,
  hauteur: 1.8,
  profondeur: 0.66,
  paroi: 0.03,
  porte: { epaisseur: 0.06, ouvertureMax: 112 }, // degrés
  // Hauteurs (m) des éléments intérieurs
  etages: {
    shelf_01: 1.42,
    shelf_02: 1.1,
    shelf_03: 0.78,
    drawer_01: 0.06,
    door_rack_01: 1.22,
    door_rack_02: 0.56,
  },
}

// Ombre cuite au sol (texture générée, pas d'ombre temps réel)
export const OMBRE = {
  frigo: { largeur: 1.25, profondeur: 1.1, opacite: 0.38 },
}

// Lumière douce
export const LUMIERE = {
  environnement: 0.6, // reflets doux (environnement généré dans le code)
  principale: { intensite: 1.7, position: [-3, 4, 2.5] },
  exposition: 1.0,
}

// Performance
export const PERF = {
  pixelRatioMax: 2,
  pixelRatioMaxMobile: 1.5,
}
