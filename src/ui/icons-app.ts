// Icônes ajoutées pour l'appli, absentes du prototype (icons.ts est généré depuis le prototype, on n'y touche pas).
import type { IconDef } from "./icons";

const LINE = { fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" };

export const APP_ICONS = {
  // Mon frigo (onglet) : deux portes et leurs poignées
  "fridge": { vb: "0 0 24 24", a: LINE, svg: "<rect x=\"6\" y=\"3\" width=\"12\" height=\"18\" rx=\"2.5\"/><path d=\"M6 10h12\"/><path d=\"M9.5 6v1.5M9.5 13v3\"/>" },
  // Accueil V3 : « Mon espace Frigia » (quatre carrés pleins)
  "grid": { vb: "0 0 24 24", a: { fill: "currentColor" }, svg: "<rect x=\"3.5\" y=\"3.5\" width=\"7.5\" height=\"7.5\" rx=\"2\"/><rect x=\"13\" y=\"3.5\" width=\"7.5\" height=\"7.5\" rx=\"2\"/><rect x=\"3.5\" y=\"13\" width=\"7.5\" height=\"7.5\" rx=\"2\"/><rect x=\"13\" y=\"13\" width=\"7.5\" height=\"7.5\" rx=\"2\"/>" },
  // Accueil V3 : les filtres, à droite de la recherche
  "sliders": { vb: "0 0 24 24", a: LINE, svg: "<path d=\"M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1\"/><circle cx=\"15\" cy=\"6\" r=\"2\"/><circle cx=\"9\" cy=\"12\" r=\"2\"/><circle cx=\"17\" cy=\"18\" r=\"2\"/>" },
  // Mon espace Frigia : les statistiques (trois barres)
  "chart": { vb: "0 0 24 24", a: { fill: "currentColor" }, svg: "<rect x=\"4\" y=\"13\" width=\"4\" height=\"7\" rx=\"1.2\"/><rect x=\"10\" y=\"9\" width=\"4\" height=\"11\" rx=\"1.2\"/><rect x=\"16\" y=\"4\" width=\"4\" height=\"16\" rx=\"1.2\"/>" },
  // Mon profil : l'abonnement
  "crown": { vb: "0 0 24 24", a: LINE, svg: "<path d=\"M4 8l4 4 4-6 4 6 4-4-1.5 10h-13z\"/>" },
  // Accueil V3 : le bas de la carte « ce soir »
  "pin": { vb: "0 0 24 24", a: LINE, svg: "<path d=\"M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z\"/><circle cx=\"12\" cy=\"10\" r=\"2.3\"/>" },
} satisfies Record<string, IconDef>;
