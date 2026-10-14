// La photo d'un plat de la semaine (cherchée d'après son titre), ou une pastille vide le temps qu'elle arrive.
import type { GeneratedRecipe } from "../../lib/types";
import { useRecipePhoto } from "../photo";

export function Dish({ recipe, className }: { recipe: GeneratedRecipe; className?: string }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  return photo ? <img className={className} src={photo} alt="" /> : <span className={(className ? className + " " : "") + "ph0"} aria-hidden="true" />;
}
