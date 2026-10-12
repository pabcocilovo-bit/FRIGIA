// 7 · Liste de courses et 8 · Planning : leur état vide, le temps de les remplir (étape 10).
import { EmptyState, Icon, LockPill, Pill, RoundButton } from "../ui/components";
import { ArtBag } from "../ui/art";
import { sinceScan, weekDays, weekRange } from "./format";
import { AppTabBar } from "./AppTabBar";
import { useOpenScan } from "./offline";
import { comingSoon } from "./toast";
import { useOpenPaywall, type Why } from "./plus/subscription";

/** Bandeau doré « Fonction Plus » en formule Gratuit. */
function LockBar({ why }: { why: Why }) {
  const openPaywall = useOpenPaywall();
  return (
    <button type="button" className="lockbar" onClick={() => openPaywall(why)}>
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

/** Planning vide : les 7 jours à venir, midi et soir, rien de prévu (prototype V3, compte sans semaine). */
export function Planning({ isPlus, lastScan }: { isPlus: boolean; lastScan?: Date }) {
  const openScan = useOpenScan();
  return (
    <div className="fa fa-app" aria-label="Planning de la semaine">
      <div className="rhead">
        <div className="row">
          {lastScan ? <span className="label">{sinceScan(lastScan)}</span> : <span />}
          <span style={{ display: "flex", gap: 8 }}>
            <RoundButton icon="pencil" label="Modifier ma semaine" tone="glass" onClick={() => comingSoon(10)} />
            <RoundButton icon="cam" label="Nouveau scan" tone="glass" onClick={openScan} />
          </span>
        </div>
        <div><span className="label">{weekRange()}</span>
          <h2>Ta semaine, <em>sans gâchis</em></h2></div>
      </div>
      <div className="rbody">
        {!isPlus && <LockBar why="planning" />}
        <p className="pl-sum">0 repas prévus</p>
        <div className="days">
          {weekDays().map((d, i) => (
            <div key={d.key} className={"pday" + (i === 0 ? " today" : "")}>
              <span className="d"><small>{d.short}</small><b>{d.date.getDate()}</b></span>
              <div className="pms">
                {(["Midi", "Soir"] as const).map(meal => (
                  <button key={meal} type="button" className="pm empty" aria-label={`Choisir le repas du ${meal.toLowerCase()}`} onClick={() => comingSoon(10)}>
                    <span className="tx"><Icon name="plus" />{meal} : rien de prévu · choisir</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Pill block icon="cart" className="plan-add" disabled>Rien à acheter, tu as tout</Pill>
        <button type="button" className="wk-add" onClick={() => comingSoon(10)}><Icon name="pencil" /><span>Modifier ma semaine</span></button>
      </div>
      <AppTabBar active="plan" isPlus={isPlus} />
    </div>
  );
}
