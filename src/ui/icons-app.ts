// Icônes ajoutées pour l'appli, absentes du prototype (icons.ts est généré depuis le prototype, on n'y touche pas).
import type { IconDef } from "./icons";

const LINE = { fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" };

export const APP_ICONS = {
  // Mon frigo (onglet) : deux portes et leurs poignées
  "fridge": { vb: "0 0 24 24", a: LINE, svg: "<rect x=\"6\" y=\"3\" width=\"12\" height=\"18\" rx=\"2.5\"/><path d=\"M6 10h12\"/><path d=\"M9.5 6v1.5M9.5 13v3\"/>" },
} satisfies Record<string, IconDef>;
