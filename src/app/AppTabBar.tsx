// Barre d'onglets branchée sur la navigation : chaque onglet a son adresse (/, /explorer, /planning, /cuisine).
// En Gratuit, Planning (cadenas) ouvre « Passe à Plus », comme le prototype. Ma cuisine est ouverte à tous (les courses, dedans, sont en Plus).
import { useNavigate } from "react-router";
import { TabBar, type TabId } from "../ui/components";
import { TAB_PATHS } from "./nav";
import { useOpenScan } from "./offline";
import { useOpenPaywall } from "./plus/subscription";

export function AppTabBar({ active, isPlus }: { active?: TabId; isPlus: boolean }) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const onTab = (t: TabId) => {
    if (t === active) return;
    if (!isPlus && t === "plan") openPaywall("planning", TAB_PATHS[t]);
    else navigate(TAB_PATHS[t]);
  };
  return <TabBar active={active} isPlus={isPlus} onTab={onTab} onScan={openScan} />;
}
