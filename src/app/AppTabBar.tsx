// Barre d'onglets branchée sur la navigation : chaque onglet a son adresse (/, /planning, /courses, /famille).
// En Gratuit, Planning et Courses (cadenas) ouvrent « Passe à Plus », comme le prototype.
import { useNavigate } from "react-router";
import { TabBar, type TabId } from "../ui/components";
import { TAB_PATHS } from "./nav";
import { useOpenScan } from "./offline";
import { useOpenPaywall } from "./plus/subscription";

export function AppTabBar({ active, isPlus }: { active: TabId; isPlus: boolean }) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const onTab = (t: TabId) => {
    if (t === active) return;
    if (!isPlus && (t === "plan" || t === "list")) openPaywall(t === "plan" ? "planning" : "courses", TAB_PATHS[t]);
    else navigate(TAB_PATHS[t]);
  };
  return <TabBar active={active} isPlus={isPlus} onTab={onTab} onScan={openScan} />;
}
