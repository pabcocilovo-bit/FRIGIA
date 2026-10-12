// 7 · Liste de courses et 8 · Planning : leur état vide, le temps de les construire (étape 10).
import { EmptyState, LockPill, Pill, RoundButton } from "../ui/components";
import { ArtBag, ArtFridge } from "../ui/art";
import { AppTabBar } from "./AppTabBar";
import { useOpenScan } from "./offline";
import { comingSoon } from "./toast";

/** Bandeau doré « Fonction Plus » en formule Gratuit. */
function LockBar() {
  return (
    <button type="button" className="lockbar" onClick={() => comingSoon(5)}>
      <span><b>Fonction Plus.</b> Tu vois un aperçu.</span>
      <LockPill>Débloquer</LockPill>
    </button>
  );
}

export function Courses({ isPlus }: { isPlus: boolean }) {
  const openScan = useOpenScan();
  return (
    <div className="fa fa-app" aria-label="Liste de courses">
      <div className="rhead">
        <div className="row"><span className="label">Pour la semaine</span></div>
        <div><h2>Ta liste de <em>courses</em></h2></div>
      </div>
      <div className="lbody">
        <EmptyState
          art={<ArtBag />}
          title={<>Ta liste est <em>vide</em></>}
          text="Sur une recette, touche « Ajouter les manquants » : ils arrivent ici, rangés par rayon."
          action={<Pill icon="cam" onClick={openScan}>Scanner mon frigo</Pill>}
        />
      </div>
      <AppTabBar active="list" isPlus={isPlus} />
    </div>
  );
}

export function Planning({ isPlus }: { isPlus: boolean }) {
  const openScan = useOpenScan();
  return (
    <div className="fa fa-app" aria-label="Planning de la semaine">
      <div className="rhead">
        <div className="row">
          <span />
          <RoundButton icon="cam" label="Nouveau scan" tone="glass" onClick={openScan} />
        </div>
        <div><h2>Ta semaine, <em>sans gâchis</em></h2></div>
      </div>
      <div className="rbody">
        {!isPlus && <LockBar />}
        {/* Le prototype n'a pas d'état vide pour le Planning : provisoire, à valider */}
        <EmptyState
          art={<ArtFridge />}
          title={<>Ta semaine est <em>vide</em></>}
          action={<Pill icon="cam" onClick={openScan}>Scanner mon frigo</Pill>}
        />
      </div>
      <AppTabBar active="plan" isPlus={isPlus} />
    </div>
  );
}

