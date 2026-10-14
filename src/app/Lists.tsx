// 7 · Liste de courses et 8 · Planning (étape 10).
import { useLocation } from "react-router";
import { EmptyState, Icon, LockPill, Pill, RoundButton } from "../ui/components";
import type { ShopItem } from "../lib/home";
import { byAisle, listText } from "../lib/shopping";
import { ArtBag } from "../ui/art";
import { plural, sinceScan, weekDays, weekRange } from "./format";
import { AppTabBar } from "./AppTabBar";
import { useOpenScan } from "./offline";
import { comingSoon, showToast } from "./toast";
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

/** 7 · Liste de courses : les manquants des recettes, rangés par rayon. On coche en faisant les courses, on envoie la liste. */
export function Courses({ isPlus, items, onToggle, onClearDone }: {
  isPlus: boolean; items: ShopItem[];
  onToggle: (id: string) => void;
  /** Retire ce qui est déjà dans le panier */
  onClearDone: () => void;
}) {
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  // Les articles qui viennent d'arriver (« Dans ta liste · voir ») s'allument un instant
  const flash = (useLocation().state as { flash?: string[] } | null)?.flash ?? [];
  const list = isPlus ? items : [];
  const done = list.filter(x => x.done).length;
  const left = list.length - done;
  const text = listText(list);
  const share = async (to: "WhatsApp" | "SMS" | "copie") => {
    if (!isPlus) { openPaywall("courses"); return; }
    if (!left) { showToast("Tout est déjà dans le panier"); return; }
    if (to === "copie") {
      try { await navigator.clipboard.writeText(text); showToast("Liste copiée"); } catch { showToast("La liste n'a pas pu être copiée"); }
      return;
    }
    const url = to === "WhatsApp" ? `https://wa.me/?text=${encodeURIComponent(text)}` : `sms:?&body=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  };
  // Le bouton du haut : le menu de partage du téléphone, sinon WhatsApp
  const shareTop = async () => {
    if (!left) { showToast("Tout est déjà dans le panier"); return; }
    if (navigator.share) {
      try { await navigator.share({ title: "Ma liste de courses", text }); } catch { /* annulé */ }
      return;
    }
    void share("WhatsApp");
  };

  return (
    <div className="fa fa-app" aria-label="Liste de courses">
      <div className="rhead">
        <div className="row">
          <span className="label">Pour la semaine</span>
          {list.length > 0 && <RoundButton icon="share" label="Partager la liste" tone="glass" onClick={shareTop} />}
        </div>
        <div>
          {list.length > 0 && <span className="label">{plural(list.length, "article")}{done ? ` · ${done} dans le panier` : ""}</span>}
          <h2>Ta liste de <em>courses</em></h2>
        </div>
      </div>
      <div className="lbody">
        {!isPlus && <LockBar why="courses" />}
        {list.length === 0 ? (
          <EmptyState
            art={<ArtBag />}
            title={<>Ta liste est <em>vide</em></>}
            text="Sur une recette, touche « Ajouter les manquants » : ils arrivent ici, rangés par rayon."
            action={<Pill icon="cam" onClick={openScan}>Scanner mon frigo</Pill>}
          />
        ) : <>
          {byAisle(list).map(([aisle, group]) => (
            <div key={aisle} className="lgroup">
              <span className="label">{aisle}</span>
              <div className="litems">
                {group.map(it => (
                  <button key={it.id} type="button" className={"litem" + (it.done ? " done" : "") + (flash.includes(it.id) ? " new" : "")}
                    aria-pressed={it.done} onClick={() => onToggle(it.id)}>
                    <span className="ck"><Icon name="check" /></span>
                    <span className="nm"><b>{it.name}</b><small>{it.from}</small></span>
                    <span className="q">{it.qty}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {done > 0 && <button type="button" className="link l-clear" onClick={onClearDone}>Retirer {done > 1 ? `les ${done} articles cochés` : "l'article coché"}</button>}
          <div className="sec"><h3>Envoyer la liste</h3></div>
          <div className="share-row">
            <button type="button" onClick={() => share("WhatsApp")}><Icon name="msg" />WhatsApp</button>
            <button type="button" onClick={() => share("SMS")}><Icon name="msg" />SMS</button>
            <button type="button" onClick={() => share("copie")}><Icon name="copy" />Copier</button>
          </div>
          <div className="drive">
            <span className="pi"><Icon name="store" /></span>
            <div><b>Commander au drive</b><span>Leclerc, Carrefour, Monoprix</span></div>
            <span className="lockpill">Bientôt</span>
          </div>
        </>}
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
