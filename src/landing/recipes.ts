// Le frigo de l'exemple et les recettes que Frigia en tirerait. Mêmes 8 ingrédients que l'écran
// « C'est bien ça ? » de l'appli et que la photo du hero, pour que tout se tienne sur la page.
export const FRIDGE = ["Courgettes", "Tomates cerises", "Poivrons", "Œufs", "Brocoli", "Carottes", "Champignons", "Lait"];

// frigo : vu sur la photo · placard : fond de placard (pâtes, huile, ail…) · achat : à acheter
export type Where = "frigo" | "placard" | "achat";
// qty : quantité par personne (null = « un filet », « quelques feuilles »…, écrit dans unit)
export type Ing = { name: string; qty: number | null; unit?: string; where: Where };
export type Recipe = { id: string; photo: string; name: string; minutes: number; ings: Ing[]; steps: string[] };

export const RECIPES: Record<string, Recipe> = {
  omelette: {
    id: "omelette", photo: "omelette-tomates", name: "Omelette poivrons et champignons", minutes: 15,
    ings: [
      { name: "Œufs", qty: 2, where: "frigo" },
      { name: "Poivrons", qty: 0.5, where: "frigo" },
      { name: "Champignons", qty: 2, where: "frigo" },
      { name: "Tomates cerises", qty: 4, where: "frigo" },
      { name: "Huile d'olive", qty: null, unit: "un filet", where: "placard" },
    ],
    steps: [
      "Coupe le poivron en lanières et les champignons en lamelles.",
      "Fais-les revenir 5 min à la poêle avec un filet d'huile.",
      "Bats les œufs avec sel et poivre, verse-les sur les légumes.",
      "Ajoute les tomates cerises coupées en deux et couvre 3 min à feu doux.",
    ],
  },
  wraps: {
    id: "wraps", photo: "wrap-proteine", name: "Wraps œufs et crudités", minutes: 15,
    ings: [
      { name: "Œufs", qty: 1, where: "frigo" },
      { name: "Carottes", qty: 0.5, where: "frigo" },
      { name: "Tomates cerises", qty: 3, where: "frigo" },
      { name: "Galettes de blé", qty: 2, where: "achat" },
    ],
    steps: [
      "Fais cuire les œufs 9 min dans l'eau bouillante, puis écale-les.",
      "Râpe les carottes et coupe les tomates cerises en quatre.",
      "Garnis chaque galette d'œuf en rondelles et de crudités.",
      "Roule bien serré et coupe en deux.",
    ],
  },
  salade: {
    id: "salade", photo: "salade-caprese", name: "Salade tomates cerises et mozzarella", minutes: 10,
    ings: [
      { name: "Tomates cerises", qty: 8, where: "frigo" },
      { name: "Mozzarella", qty: 60, unit: "g", where: "achat" },
      { name: "Huile d'olive", qty: null, unit: "un filet", where: "placard" },
    ],
    steps: [
      "Coupe les tomates cerises en deux et la mozzarella en dés.",
      "Mélange avec un filet d'huile, du sel et du poivre.",
      "Laisse reposer 5 min au frais avant de servir.",
    ],
  },
  penne: {
    id: "penne", photo: "pasta-legumes", name: "Penne aux légumes rôtis", minutes: 25,
    ings: [
      { name: "Courgettes", qty: 0.5, where: "frigo" },
      { name: "Poivrons", qty: 0.5, where: "frigo" },
      { name: "Tomates cerises", qty: 5, where: "frigo" },
      { name: "Champignons", qty: 2, where: "frigo" },
      { name: "Penne", qty: 80, unit: "g", where: "placard" },
      { name: "Ail", qty: 0.5, unit: "gousse", where: "placard" },
    ],
    steps: [
      "Préchauffe le four à 200 °C.",
      "Coupe les légumes en morceaux, mélange-les avec l'ail, de l'huile et du sel.",
      "Fais-les rôtir 20 min, en remuant à mi-cuisson.",
      "Pendant ce temps, cuis les penne, puis mélange-les aux légumes.",
    ],
  },
  gratin: {
    id: "gratin", photo: "gratin-courgettes", name: "Gratin de courgettes", minutes: 35,
    ings: [
      { name: "Courgettes", qty: 1, where: "frigo" },
      { name: "Œufs", qty: 1, where: "frigo" },
      { name: "Lait", qty: 8, unit: "cl", where: "frigo" },
      { name: "Fromage râpé", qty: 30, unit: "g", where: "achat" },
    ],
    steps: [
      "Préchauffe le four à 200 °C et coupe les courgettes en rondelles.",
      "Fais-les revenir 5 min à la poêle pour qu'elles rendent leur eau.",
      "Bats les œufs avec le lait, du sel et du poivre.",
      "Mets les courgettes dans un plat, verse le mélange, couvre de fromage et enfourne 25 min.",
    ],
  },
  soupe: {
    id: "soupe", photo: "soupe-detox", name: "Soupe verte courgette-brocoli", minutes: 25,
    ings: [
      { name: "Courgettes", qty: 0.5, where: "frigo" },
      { name: "Brocoli", qty: 0.25, where: "frigo" },
      { name: "Carottes", qty: 0.5, where: "frigo" },
      { name: "Lait", qty: 5, unit: "cl", where: "frigo" },
      { name: "Ail", qty: 0.5, unit: "gousse", where: "placard" },
    ],
    steps: [
      "Coupe les légumes en morceaux et écrase l'ail.",
      "Couvre d'eau salée et laisse cuire 20 min à couvert.",
      "Mixe avec le lait jusqu'à ce que ce soit bien lisse.",
      "Poivre et sers bien chaud.",
    ],
  },
};

export type Envie = "rapide" | "enfants" | "gaspi" | "vege";
export const ENVIES: [Envie, string][] = [["rapide", "Rapide"], ["enfants", "Les enfants adorent"], ["gaspi", "Anti-gaspi"], ["vege", "Végé"]];
export const IDEAS: Record<Envie, string[]> = {
  rapide: ["omelette", "wraps", "salade"],
  enfants: ["penne", "gratin", "wraps"],
  gaspi: ["soupe", "omelette", "penne"],
  vege: ["gratin", "soupe", "penne"],
};

// « 4/4 dans ton frigo », « manque 1 » : le fond de placard ne compte pas
export function fridgeScore(r: Recipe) {
  const inFridge = r.ings.filter(i => i.where === "frigo").length;
  const missing = r.ings.filter(i => i.where === "achat").length;
  return { inFridge, total: inFridge + missing, missing };
}

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

// Quantité pour n personnes : au quart près pour les pièces, à 10 g ou 5 cl près pour le reste
export function quantity(i: Ing, people: number): string {
  if (i.qty === null) return i.unit ?? "";
  const total = i.qty * people;
  if (i.unit === "g") return `${Math.max(10, Math.round(total / 10) * 10)} g`;
  if (i.unit === "cl") return `${Math.max(5, Math.round(total / 5) * 5)} cl`;
  const q = Math.max(0.25, Math.round(total * 4) / 4);
  const whole = Math.floor(q), frac = FRACTIONS[q - whole] ?? "";
  const n = whole ? `${whole}${frac ? ` ${frac}` : ""}` : frac;
  return i.unit ? `${n} ${i.unit}${q > 1 ? "s" : ""}` : n;
}
