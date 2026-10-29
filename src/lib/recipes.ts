// Recettes : icônes, texte à partager, photo du plat.
import type { GeneratedRecipe } from "./types";

/** Une durée lisible : « 45 min », et en heures au-delà de 60 min (Hugo, 28 octobre) : « 1 h », « 1 h 30 ». */
export function minText(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}
/** La durée gardée avec une recette (« 90 min », même dans les anciennes), écrite comme minText. */
export const timeText = (time: string | undefined): string => {
  const m = /^\s*(\d+)\s*min\b/.exec(time ?? "");
  return m ? minText(Number(m[1])) : time ?? "";
};

export function ingredientIcon(name: string) {
  const l = name.toLowerCase();
  if (l.includes("œuf") || l.includes("oeuf")) return "🥚";
  if (l.includes("tomate")) return "🍅";
  if (l.includes("fromage") || l.includes("emmental") || l.includes("mozza") || l.includes("parmesan") || l.includes("comté") || l.includes("gruyère")) return "🧀";
  if (l.includes("lait") || l.includes("crème") || l.includes("creme")) return "🥛";
  if (l.includes("brocoli")) return "🥦";
  if (l.includes("citron")) return "🍋";
  if (l.includes("orange")) return "🍊";
  if (l.includes("salade") || l.includes("laitue") || l.includes("épinard") || l.includes("spinard")) return "🥬";
  if (l.includes("poulet") || l.includes("dinde")) return "🍗";
  if (l.includes("bœuf") || l.includes("boeuf") || l.includes("steak") || l.includes("viande") || l.includes("bifteck")) return "🥩";
  if (l.includes("porc") || l.includes("bacon") || l.includes("jambon") || l.includes("lardons")) return "🥓";
  if (l.includes("pâte") || l.includes("pasta") || l.includes("spaghetti") || l.includes("linguine") || l.includes("tagliatelle")) return "🍝";
  if (l.includes("riz")) return "🍚";
  if (l.includes("carotte")) return "🥕";
  if (l.includes("avocat")) return "🥑";
  if (l.includes("pain") || l.includes("baguette")) return "🍞";
  if (l.includes("poisson") || l.includes("saumon") || l.includes("cabillaud") || l.includes("thon") || l.includes("dorade")) return "🐟";
  if (l.includes("crevette") || l.includes("moule") || l.includes("homard")) return "🦐";
  if (l.includes("ail")) return "🧄";
  if (l.includes("oignon") || l.includes("échalote")) return "🧅";
  if (l.includes("pomme de terre") || l.includes("patate")) return "🥔";
  if (l.includes("champignon")) return "🍄";
  if (l.includes("poivron")) return "🫑";
  if (l.includes("concombre")) return "🥒";
  if (l.includes("courgette")) return "🥒";
  if (l.includes("aubergine")) return "🍆";
  if (l.includes("maïs") || l.includes("mais")) return "🌽";
  if (l.includes("pomme")) return "🍎";
  if (l.includes("fraise")) return "🍓";
  if (l.includes("banane")) return "🍌";
  if (l.includes("beurre") || l.includes("margarine")) return "🧈";
  if (l.includes("huile")) return "🫙";
  if (l.includes("farine")) return "🌾";
  if (l.includes("sucre") || l.includes("miel")) return "🍯";
  if (l.includes("chocolat")) return "🍫";
  if (l.includes("herbe") || l.includes("basilic") || l.includes("persil") || l.includes("thym") || l.includes("romarin") || l.includes("coriandre")) return "🌿";
  if (l.includes("piment") || l.includes("paprika") || l.includes("curry") || l.includes("épice") || l.includes("cumin")) return "🌶️";
  if (l.includes("sel") || l.includes("poivre")) return "🧂";
  if (l.includes("bouillon") || l.includes("sauce")) return "🫕";
  if (l.includes("tofu")) return "🫘";
  if (l.includes("lentille") || l.includes("pois") || l.includes("haricot") || l.includes("fève")) return "🫘";
  if (l.includes("noix") || l.includes("amande") || l.includes("noisette") || l.includes("pistache")) return "🥜";
  return "🌱";
}

export function recipeIcon(title: string) {
  const l = title.toLowerCase();
  if (l.includes("omelette") || l.includes("œuf") || l.includes("oeuf"))
    return "🍳";
  if (l.includes("salade") || l.includes("bowl")) return "🥗";
  if (l.includes("pasta") || l.includes("pâte")) return "🍝";
  if (l.includes("soupe")) return "🥣";
  if (l.includes("poulet")) return "🍗";
  if (l.includes("wrap")) return "🌯";
  if (l.includes("gratin")) return "🧀";
  if (l.includes("poêlée") || l.includes("poelee")) return "🥘";
  return "🍽️";
}

export function buildShareText(r: GeneratedRecipe): string {
  const lines: string[] = [];
  lines.push(r.title);
  lines.push(`⏱ ${timeText(r.time)}  🔥 ${r.cal} kcal  📊 ${r.diff}`);
  if (r.recipeIngredients && r.recipeIngredients.length > 0) {
    lines.push("");
    lines.push("🛒 Ingrédients :");
    r.recipeIngredients.forEach(ing => lines.push(`${ingredientIcon(ing.name)} ${ing.name}${ing.qty ? ` — ${ing.qty}` : ""}`));
  }
  if (r.steps && r.steps.length > 0) {
    lines.push("");
    lines.push("👨‍🍳 Étapes :");
    r.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }
  lines.push("");
  lines.push("———");
  lines.push("Recette générée avec Frigia 🍽️");
  lines.push("Votre chef IA personnel — frigia.fr");
  return lines.join("\n");
}

// Cache au niveau du module : survit aux rendus, repart à zéro au rechargement
export const mealImageCache: Record<string, string> = {};

export async function fetchTheMealImage(query: string): Promise<string | null> {
  const trySearch = async (q: string) => {
    try {
      const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
      const d = await r.json() as { meals?: { strMealThumb: string }[] };
      if (d.meals?.[0]) return d.meals[0].strMealThumb;
    } catch { /* pas de réseau : pas de photo */ }
    return null;
  };
  const url = await trySearch(query);
  if (url) return url;
  // Sinon, juste le type de plat (le dernier mot : "mushroom pasta" → "pasta")
  const dish = query.trim().split(/\s+/).pop();
  if (dish && dish !== query) return trySearch(dish);
  return null;
}
