// Les recettes de la semaine, en haut de l'accueil : des plats connus, avec leur photo. L'ordre tourne chaque lundi,
// la première est « la recette de la semaine ». Ce qu'on a déjà est vérifié dans Ma cuisine à l'ouverture.
import type { GeneratedRecipe, RecipeItem, StepTimer } from "../lib/types";
import type { FridgeItem } from "../lib/home";
import { recipeIcon } from "../lib/recipes";
import { inFridge } from "./scan/portions";

type Step = [string, StepTimer?];
type Item = [name: string, plural: string, qty: number | null, unit: string];
type Base = { title: string; photo: string; alt: string; intro: string; minutes: number; cal: number; diff: string;
  veg?: boolean; oven?: boolean; cold?: boolean; origin?: string; items: Item[]; steps: Step[] };

const BASE: Base[] = [
  {
    title: "Gratin de courgettes", photo: "gratin-courgettes", alt: "Gratin de courgettes doré dans un plat blanc",
    intro: "Des courgettes fondantes sous une croûte de fromage dorée. Simple, et tout le monde se ressert.",
    minutes: 45, cal: 320, diff: "Facile", veg: true, oven: true,
    items: [["courgette", "courgettes", 3, ""], ["œuf", "œufs", 2, ""], ["crème fraîche", "crème fraîche", 20, "cl"],
      ["gruyère râpé", "gruyère râpé", 80, "g"], ["gousse d'ail", "gousses d'ail", 1, ""], ["thym", "thym", null, ""]],
    steps: [["Préchauffe le four à 200 °C. Coupe les courgettes en rondelles fines."],
      ["Fais-les revenir 5 minutes à la poêle avec un filet d'huile et l'ail écrasé.", { label: "Poêle", min: 5 }],
      ["Bats les œufs avec la crème, la moitié du gruyère, sel et poivre."],
      ["Mets les courgettes dans un plat, verse le mélange et couvre avec le reste du gruyère et le thym."],
      ["Enfourne jusqu'à ce que le dessus soit bien doré.", { label: "Four", min: 30 }]],
  },
  {
    title: "Velouté de courgettes et brocoli", photo: "soupe-detox", alt: "Velouté vert de courgettes et brocoli dans un bol",
    intro: "Un velouté tout vert, doux et léger. Parfait pour finir les légumes du bac.",
    minutes: 30, cal: 210, diff: "Facile", veg: true,
    items: [["courgette", "courgettes", 2, ""], ["brocoli", "brocolis", 1, ""], ["oignon", "oignons", 1, ""],
      ["bouillon de légumes", "bouillon de légumes", 1, "l"], ["crème fraîche", "crème fraîche", 2, "c. à s."]],
    steps: [["Émince l'oignon. Coupe les courgettes en dés et le brocoli en petits bouquets."],
      ["Fais revenir l'oignon 3 minutes dans une casserole avec un filet d'huile.", { label: "Oignon", min: 3 }],
      ["Ajoute les légumes et le bouillon. Laisse cuire à petit feu.", { label: "Cuisson", min: 20 }],
      ["Mixe avec la crème. Sale et poivre à ton goût."]],
  },
  {
    title: "Wraps au poulet grillé et crudités", photo: "wrap-proteine", alt: "Wraps au poulet grillé coupés en deux",
    intro: "Du poulet doré, des crudités qui croquent, une sauce au yaourt. À manger avec les mains.",
    minutes: 20, cal: 480, diff: "Facile",
    items: [["galette de blé", "galettes de blé", 2, ""], ["blanc de poulet", "blancs de poulet", 2, ""], ["poivron", "poivrons", 1, ""],
      ["concombre", "concombres", 0.5, ""], ["salade", "salade", 2, "feuilles"], ["yaourt nature", "yaourts nature", 1, ""], ["citron", "citrons", 0.5, ""]],
    steps: [["Coupe le poulet en lanières. Sale, poivre et fais-le dorer à la poêle avec un filet d'huile.", { label: "Poulet", min: 8 }],
      ["Coupe le poivron et le concombre en bâtonnets."],
      ["Mélange le yaourt avec le jus du citron, sel et poivre."],
      ["Chauffe les galettes 30 secondes à la poêle. Garnis de salade, crudités, poulet et sauce, puis roule-les bien serré."]],
  },
  {
    title: "Penne aux légumes rôtis", photo: "pasta-legumes", alt: "Penne aux légumes rôtis et basilic",
    intro: "Les légumes rôtissent pendant que les pâtes cuisent. Un plat coloré, prêt sans effort.",
    minutes: 35, cal: 540, diff: "Facile", veg: true, oven: true,
    items: [["penne", "penne", 200, "g"], ["courgette", "courgettes", 1, ""], ["poivron", "poivrons", 1, ""],
      ["tomate cerise", "tomates cerises", 12, ""], ["parmesan", "parmesan", 30, "g"], ["basilic", "basilic", 6, "feuilles"]],
    steps: [["Préchauffe le four à 220 °C. Coupe la courgette et le poivron en gros morceaux."],
      ["Mets-les sur une plaque avec les tomates, un filet d'huile, sel et poivre.", { label: "Four", min: 20 }],
      ["Pendant ce temps, fais cuire les penne dans l'eau salée.", { label: "Pâtes", min: 10 }],
      ["Mélange les pâtes et les légumes. Ajoute le parmesan et le basilic au moment de servir."]],
  },
  {
    title: "Omelette aux tomates cerises", photo: "omelette-tomates", alt: "Omelette pliée aux tomates cerises et basilic dans une poêle",
    intro: "Une omelette baveuse, des tomates juste chaudes et du basilic. Prête en un quart d'heure.",
    minutes: 15, cal: 340, diff: "Facile", veg: true,
    items: [["œuf", "œufs", 5, ""], ["tomate cerise", "tomates cerises", 10, ""], ["basilic", "basilic", 6, "feuilles"], ["beurre", "beurre", 10, "g"]],
    steps: [["Coupe les tomates en deux. Bats les œufs avec sel et poivre."],
      ["Fais revenir les tomates 2 minutes dans la poêle avec le beurre.", { label: "Tomates", min: 2 }],
      ["Verse les œufs. Laisse prendre à feu moyen en ramenant les bords vers le centre.", { label: "Omelette", min: 4 }],
      ["Plie l'omelette en deux et parsème de basilic."]],
  },
  {
    title: "Salade caprese", photo: "salade-caprese", alt: "Salade de tomates, mozzarella et basilic",
    intro: "La salade italienne toute simple : tomate, mozzarella, basilic et un bon filet d'huile d'olive.",
    minutes: 10, cal: 380, diff: "Facile", veg: true, cold: true, origin: "Spécialité italienne",
    items: [["tomate", "tomates", 3, ""], ["mozzarella", "mozzarellas", 1, ""], ["basilic", "basilic", 8, "feuilles"], ["huile d'olive", "huile d'olive", 2, "c. à s."]],
    steps: [["Coupe les tomates et la mozzarella en tranches."],
      ["Alterne-les dans une assiette avec les feuilles de basilic."],
      ["Arrose d'huile d'olive. Sale, poivre, et sers bien frais."]],
  },
];

const qtyLabel = (i: RecipeItem) => (i.qty == null ? "un peu" : `${String(i.qty).replace(".", ",")}${i.unit ? " " + i.unit : ""}`);

/** Les recettes de la semaine, la première change chaque lundi. have : déjà dans Ma cuisine. */
export function weekRecipes(kitchen: Pick<FridgeItem, "name">[], now = new Date()): { recipe: GeneratedRecipe; alt: string }[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = Math.floor(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) / (7 * 86400000));
  const start = week % BASE.length;
  return [...BASE.slice(start), ...BASE.slice(0, start)].map(b => {
    const items: RecipeItem[] = b.items.map(([name, plural, qty, unit]) => ({ name, plural, qty, unit, have: inFridge(name, kitchen) }));
    const recipe: GeneratedRecipe = {
      emoji: recipeIcon(b.title), title: b.title,
      time: `${b.minutes} min`, minutes: b.minutes, cal: b.cal, diff: b.diff,
      imageSearch: `/landing/${b.photo}.jpg`,
      intro: b.intro, veg: !!b.veg, oven: !!b.oven, cold: !!b.cold, ...(b.origin ? { origin: b.origin } : {}),
      serves: 2, items,
      recipeIngredients: items.map(i => ({ name: i.qty != null && i.qty > 1 && !i.unit ? i.plural : i.name, qty: qtyLabel(i) })),
      steps: b.steps.map(([text]) => text),
      timers: b.steps.map(([, t]) => t ?? null),
      missing: "",
    };
    return { recipe, alt: b.alt };
  });
}
