// Barre d'onglets branchée sur la navigation : chaque onglet a son adresse (/, /planning, /courses, /famille).
import { useNavigate } from "react-router";
import { TabBar, type TabId } from "../ui/components";
import { TAB_PATHS } from "./nav";
import { useOpenScan } from "./offline";

export function AppTabBar({ active, isPlus }: { active: TabId; isPlus: boolean }) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  return <TabBar active={active} isPlus={isPlus} onTab={t => { if (t !== active) navigate(TAB_PATHS[t]); }} onScan={openScan} />;
}
