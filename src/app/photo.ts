// Photo d'un plat, trouvée comme dans l'ancienne appli (TheMealDB, gardée en mémoire).
import { useEffect, useState } from "react";
import { fetchTheMealImage, mealImageCache } from "../lib/recipes";

export function useRecipePhoto(title: string | undefined, imageSearch?: string): string | null {
  const query = imageSearch || title || "";
  // Une adresse (photo trouvée par le serveur, ou une photo de l'appli comme les recettes de la semaine)
  const direct = query.startsWith("http") || query.startsWith("/") ? query : null;
  const [found, setFound] = useState<{ query: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!query || direct || mealImageCache[query]) return;
    let cancelled = false;
    fetchTheMealImage(query).then(url => {
      if (cancelled) return;
      if (url) mealImageCache[query] = url;
      setFound({ query, url });
    });
    return () => { cancelled = true; };
  }, [query, direct]);
  if (!query) return null;
  return direct || mealImageCache[query] || (found?.query === query ? found.url : null);
}
