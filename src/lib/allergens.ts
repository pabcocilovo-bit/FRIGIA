import type { GeneratedRecipe } from "./types";
import type { Person } from "./household";
import { isEn } from "./i18n";

// Les allergies du foyer (les 9 de Famille) et les ingrédients qui en contiennent, pour l'alerte de la fiche recette
// (Hugo, 30 octobre). Les recettes sont faites sans, mais une recette du catalogue, des favoris ou d'avant l'ajout d'une allergie
// peut en contenir : on prévient. [mots, sauf si…]
const ALLERGENS: Record<string, [string[], string[]]> = {
  arachides: [["arachide", "cacahuete", "cacahouete", "peanut", "groundnut"], []],
  "fruits à coque": [["noix", "noisette", "amande", "cajou", "pistache", "pecan", "macadamia", "praline", "frangipane", "nutella",
    "nut", "walnut", "hazelnut", "almond", "cashew", "pistachio", "pecan"], ["coco", "muscade", "coconut", "nutmeg", "butternut", "peanut"]],
  "œufs": [["oeuf", "mayonnaise", "meringue", "egg", "mayo"], ["eggplant"]],
  lait: [["lait", "beurre", "creme", "fromage", "parmesan", "mozzarella", "emmental", "comte", "gruyere", "feta", "ricotta", "mascarpone", "yaourt",
    "chevre", "roquefort", "camembert", "brie", "reblochon", "raclette", "burrata", "cheddar", "skyr", "gorgonzola", "pecorino", "bechamel", "lactose",
    "milk", "butter", "cream", "cheese", "yogurt", "yoghurt", "goat cheese"],
  ["de coco", "de soja", "d amande", "d avoine", "de riz", "vegetal", "de cacahuete", "de marron",
    "coconut", "soy", "oat", "rice", "almond", "plant", "peanut butter", "cocoa butter", "dairy free", "vegan"]],
  gluten: [["farine", "ble", "pates", "penne", "spaghetti", "tagliatelle", "lasagne", "fusilli", "macaroni", "coquillette", "nouille", "pain", "brioche",
    "baguette", "chapelure", "semoule", "boulgour", "couscous", "seigle", "orge", "epeautre", "biscuit", "tortilla", "wrap", "pate feuilletee",
    "pate brisee", "pate sablee", "pate a pizza", "crouton", "gnocchi", "ravioli", "udon", "seitan",
    "flour", "wheat", "pasta", "noodle", "bread", "breadcrumb", "barley", "rye", "spelt", "pastry", "bun", "cracker"],
  ["sans gluten", "de riz", "de mais", "sarrasin", "pois chiche", "de coco", "chataigne", "d amande", "de curry", "de piment", "de tomate", "de coing", "de fruit",
    "gluten free", "rice flour", "rice noodle", "corn tortilla", "buckwheat", "chickpea flour"]],
  poisson: [["poisson", "saumon", "thon", "cabillaud", "colin", "merlu", "sardine", "maquereau", "truite", "dorade", "anchois", "haddock", "hareng",
    "eglefin", "merlan", "lotte", "tilapia", "surimi", "nuoc mam",
    "fish", "salmon", "tuna", "cod", "hake", "mackerel", "trout", "anchovy", "anchovie", "herring", "fish sauce"], []],
  "crustacés": [["crevette", "gambas", "crabe", "homard", "langouste", "langoustine", "ecrevisse", "prawn", "shrimp", "crab", "lobster", "crayfish"], []],
  soja: [["soja", "tofu", "tempeh", "edamame", "miso", "tamari", "soy", "soya"], []],
  "sésame": [["sesame", "tahini", "tahin", "gomasio", "houmous", "hummus", "sesame"], []],
};
/** Le nom d'une allergie à l'écran (la liste garde la clé française) */
const ALLERGY_EN: Record<string, string> = {
  arachides: "peanuts", "fruits à coque": "tree nuts", "œufs": "eggs", lait: "milk", gluten: "gluten", poisson: "fish",
  "crustacés": "shellfish", soja: "soy", "sésame": "sesame",
};
export const allergyName = (a: string) => (isEn && ALLERGY_EN[a]) || a;
const flat = (s: string) => ` ${s.toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, " ").trim()} `;
/** Un mot entier, au singulier ou au pluriel : « noix » trouve « noix », pas « noix de coco » */
const contains = (name: string, allergy: string) => {
  const n = flat(name);
  const [hits, unless] = ALLERGENS[allergy] ?? [[allergy], []];
  return hits.some(w => new RegExp(` ${flat(w).trim().replace(/[sx]$/, "")}[sx]? `).test(n)) && !unless.some(w => n.includes(flat(w)));
};

/** « Jade (lait) : parmesan, crème » : ceux qui mangent et ce qui, dans la recette, contient leur allergie. */
export function allergyHits(r: GeneratedRecipe, eaters: Person[]): { who: string; allergy: string; items: string[] }[] {
  const names = r.items?.length ? r.items.map(i => i.name) : (r.recipeIngredients ?? []).map(i => i.name);
  return eaters.flatMap(p => p.allergies.map(a => ({ who: p.name, allergy: a, items: names.filter(n => contains(n, a)) })))
    .filter(h => h.items.length > 0);
}
