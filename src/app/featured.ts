// Les recettes de la semaine, en haut de l'accueil : des recettes simples, avec leur photo et leur accroche.
// Ce qu'on a déjà est vérifié dans Ma cuisine à l'ouverture.
import type { GeneratedRecipe, RecipeItem, StepTimer } from "../lib/types";
import type { FridgeItem } from "../lib/home";
import { recipeIcon } from "../lib/recipes";
import { inFridge } from "./scan/portions";

type Step = [string, StepTimer?];
type Item = [name: string, plural: string, qty: number | null, unit: string];
type Base = { title: string; photo: string; alt: string; /** L'accroche du carrousel (« Seulement 3 ingrédients ») */ kicker: string;
  intro: string; minutes: number; cal: number; diff: string; serves: number;
  veg?: boolean; oven?: boolean; cold?: boolean; origin?: string; items: Item[]; steps: Step[] };

/** La photo d'une recette de la semaine : faite par l'IA dans le style du catalogue (api/_images.ts, FEATURED), le 27 octobre.
 *  Les photos du document de Hugo restent dans public/featured. */
export const featuredPhoto = (photo: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/recipe-images/featured/${photo}.webp`;

// Les 6 recettes choisies par Hugo le 21 octobre (« FRIGIA_6_recettes_avec_photos »), pour l'instant.
// Photos : public/featured, recadrées sans les textes du document.
const BASE: Base[] = [
  {
    title: "Pancakes moelleux à la banane", photo: "pancakes-banane", alt: "Pile de pancakes, rondelles de banane et filet de miel",
    kicker: "Seulement 3 ingrédients",
    intro: "Une banane, deux œufs et des flocons d'avoine : c'est tout. À servir avec des fruits frais.",
    minutes: 10, cal: 215, diff: "Facile", serves: 2, veg: true,
    items: [["banane", "bananes", 1, ""], ["œuf", "œufs", 2, ""], ["flocons d'avoine", "flocons d'avoine", 50, "g"]],
    steps: [["Écrase la banane dans un bol."],
      ["Ajoute les œufs et les flocons d'avoine, puis mélange. Pour une pâte lisse, mixe-la."],
      ["Verse de petites portions dans une poêle antiadhésive légèrement huilée."],
      ["Fais cuire à feu moyen-doux, 2 à 3 minutes par face.", { label: "Pancakes", min: 3 }]],
  },
  {
    title: "Burger healthy au poulet et à l'avocat", photo: "burger-poulet-avocat", alt: "Burger au poulet croustillant et salade",
    kicker: "Le fast-food autrement",
    intro: "Le burger maison, version légère : poulet au paprika, avocat et une sauce yaourt-moutarde. Sans viande : une galette végétale et un yaourt végétal.",
    minutes: 20, cal: 440, diff: "Facile", serves: 2,
    items: [["pain à burger complet", "pains à burger complets", 2, ""], ["filet de poulet", "filets de poulet", 240, "g"], ["avocat", "avocats", 1, ""],
      ["tomate", "tomates", 1, ""], ["laitue", "laitue", 2, "feuilles"], ["yaourt nature", "yaourt nature", 2, "c. à s."], ["moutarde", "moutarde", 1, "c. à c."],
      ["paprika", "paprika", null, ""]],
    steps: [["Assaisonne le poulet avec le paprika, du sel et du poivre."],
      ["Fais-le cuire à la poêle 5 à 7 minutes de chaque côté, jusqu'à ce qu'il soit bien cuit.", { label: "Poulet", min: 12 }],
      ["Mélange le yaourt et la moutarde : c'est la sauce."],
      ["Coupe la tomate et l'avocat en tranches, puis fais toaster les pains."],
      ["Monte les burgers : sauce, laitue, poulet, tomate et avocat."]],
  },
  {
    title: "Pizza tortilla croustillante", photo: "pizza-tortilla", alt: "Pizza fine à la mozzarella, tomates cerises et basilic",
    kicker: "Une pizza en 12 min",
    intro: "Une tortilla en guise de pâte, et la pizza est prête en 12 minutes. Ajoute les légumes qui traînent dans ton frigo.",
    minutes: 12, cal: 380, diff: "Facile", serves: 1, veg: true, oven: true,
    items: [["tortilla de blé", "tortillas de blé", 1, ""], ["coulis de tomate", "coulis de tomate", 3, "c. à s."], ["mozzarella", "mozzarella", 60, "g"],
      ["basilic", "basilic", null, ""]],
    steps: [["Préchauffe le four à 220 °C."],
      ["Pose la tortilla sur une plaque recouverte de papier cuisson."],
      ["Étale le coulis de tomate et répartis la mozzarella."],
      ["Enfourne jusqu'à ce que les bords soient dorés.", { label: "Four", min: 8 }],
      ["Ajoute le basilic juste avant de servir."]],
  },
  {
    title: "Pommes de terre smashées au parmesan", photo: "pommes-de-terre-smashees", alt: "Pommes de terre dorées au parmesan et aux herbes",
    kicker: "L'astuce anti-gaspi",
    intro: "Des pommes de terre écrasées puis rôties : fondantes dedans, croustillantes dehors. Avec des pommes de terre déjà cuites, c'est encore plus rapide.",
    minutes: 35, cal: 260, diff: "Facile", serves: 2, veg: true, oven: true,
    items: [["petite pomme de terre", "petites pommes de terre", 400, "g"], ["parmesan râpé", "parmesan râpé", 30, "g"], ["huile d'olive", "huile d'olive", 1, "c. à s."],
      ["herbes séchées", "herbes séchées", 1, "c. à c."]],
    steps: [["Fais cuire les pommes de terre dans l'eau bouillante, jusqu'à ce qu'elles soient tendres.", { label: "Cuisson", min: 18 }],
      ["Préchauffe le four à 220 °C."],
      ["Pose les pommes de terre sur une plaque et écrase-les doucement avec le fond d'un verre."],
      ["Ajoute l'huile, le parmesan, les herbes, du sel et du poivre."],
      ["Enfourne jusqu'à ce qu'elles soient croustillantes.", { label: "Four", min: 13 }]],
  },
  {
    title: "One-pot pasta aux tomates et épinards", photo: "one-pot-pasta", alt: "Spaghetti aux tomates cerises et épinards",
    kicker: "Tout dans une casserole",
    intro: "Tout cuit ensemble dans une seule casserole. Le crémeux vient de l'amidon des pâtes, sans crème.",
    minutes: 20, cal: 440, diff: "Facile", serves: 2, veg: true,
    items: [["pâtes", "pâtes", 180, "g"], ["tomate cerise", "tomates cerises", 150, "g"], ["pousses d'épinards", "pousses d'épinards", 80, "g"],
      ["gousse d'ail", "gousses d'ail", 1, ""], ["bouillon", "bouillon", 450, "ml"], ["parmesan", "parmesan", 25, "g"], ["huile d'olive", "huile d'olive", 1, "c. à s."]],
    steps: [["Mets dans une casserole les pâtes, les tomates coupées en deux, l'ail haché, l'huile et le bouillon (ou de l'eau)."],
      ["Porte à frémissement et laisse cuire en remuant souvent.", { label: "Pâtes", min: 11 }],
      ["Ajoute un peu d'eau si les pâtes accrochent."],
      ["Ajoute les épinards et laisse-les tomber.", { label: "Épinards", min: 2 }],
      ["Termine avec le parmesan et du poivre."]],
  },
  {
    title: "Brownie fondant sans farine", photo: "brownie-banane", alt: "Brownies fondants au chocolat",
    kicker: "Le dessert malin",
    intro: "Banane, purée de cacahuète et cacao : un brownie fondant, sans sucre ajouté. Attention, il contient des arachides.",
    minutes: 25, cal: 160, diff: "Facile", serves: 6, veg: true, oven: true,
    items: [["banane très mûre", "bananes très mûres", 2, ""], ["purée de cacahuète", "purée de cacahuète", 120, "g"], ["cacao non sucré", "cacao non sucré", 30, "g"]],
    steps: [["Préchauffe le four à 180 °C."],
      ["Écrase les bananes jusqu'à obtenir une purée lisse."],
      ["Ajoute la purée de cacahuète et le cacao, puis mélange."],
      ["Verse dans un petit moule d'environ 15 × 15 cm recouvert de papier cuisson."],
      ["Fais cuire, puis laisse refroidir avant de découper.", { label: "Four", min: 20 }]],
  },
];

const qtyLabel = (i: RecipeItem) => (i.qty == null ? "un peu" : `${String(i.qty).replace(".", ",")}${i.unit ? " " + i.unit : ""}`);

/** Les recettes du carrousel, dans l'ordre du document de Hugo (plus de rotation chaque lundi pour l'instant). have : déjà dans Ma cuisine. */
export function weekRecipes(kitchen: Pick<FridgeItem, "name">[]): { recipe: GeneratedRecipe; alt: string; kicker: string }[] {
  return BASE.map(b => {
    const items: RecipeItem[] = b.items.map(([name, plural, qty, unit]) => ({ name, plural, qty, unit, have: inFridge(name, kitchen) }));
    const recipe: GeneratedRecipe = {
      emoji: recipeIcon(b.title), title: b.title,
      time: `${b.minutes} min`, minutes: b.minutes, cal: b.cal, diff: b.diff,
      imageSearch: featuredPhoto(b.photo),
      intro: b.intro, veg: !!b.veg, oven: !!b.oven, cold: !!b.cold, ...(b.origin ? { origin: b.origin } : {}),
      serves: b.serves, items,
      recipeIngredients: items.map(i => ({ name: i.qty != null && i.qty > 1 && !i.unit ? i.plural : i.name, qty: qtyLabel(i) })),
      steps: b.steps.map(([text]) => text),
      timers: b.steps.map(([, t]) => t ?? null),
      missing: "",
    };
    return { recipe, alt: b.alt, kicker: b.kicker };
  });
}
