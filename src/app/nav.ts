// Chemins des écrans et retour en arrière (le bouton retour du téléphone fait la même chose).
import { useLocation, useNavigate } from "react-router";
import type { TabId } from "../ui/components";

export const TAB_PATHS: Record<TabId, string> = { home: "/", plan: "/planning", list: "/cuisine", family: "/famille" };

/** Revient à l'écran d'avant ; si l'appli s'est ouverte directement ici, revient à l'accueil. */
export function useBack() {
  const navigate = useNavigate();
  const location = useLocation();
  return () => (location.key === "default" ? navigate("/", { replace: true }) : navigate(-1));
}
