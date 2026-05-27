import { supabase } from "./supabase";

export async function saveRecipe(recipe: any, userId: string) {
  const { error } = await supabase.from("recipes").insert({
    user_id: userId,
    title: recipe.title,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    image_url: recipe.image,
  });

  if (error) {
    console.error(error);
  }
}

export async function loadRecipes(userId: string) {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}