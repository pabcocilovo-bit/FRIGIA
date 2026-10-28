// 7 · Liste de courses (étape 10), la 2e page de l'onglet « Ma cuisine ». Le planning est dans plan/.
import { useState } from "react";
import { useLocation } from "react-router";
import { EmptyState, Icon, Pill, RoundButton } from "../ui/components";
import type { ShopItem } from "../lib/home";
import { byAisle, listText, typedItem } from "../lib/shopping";
import { ArtBag } from "../ui/art";
import { plural } from "./format";
import { AppTabBar } from "./AppTabBar";
import { FridgeTabs } from "./fridge/Fridge";
import { useOpenScan } from "./offline";
import { showToast } from "./toast";

/** 7 · Liste de courses : les manquants des recettes, rangés par rayon. On coche en faisant les courses, on envoie la liste.
 *  Ouverte à tous depuis le 21 octobre (choix de Hugo) : Plus garde la liste de la semaine en un appui, depuis le Planning. */
export function Courses({ isPlus, items, onToggle, onAdd, onClearDone }: {
  isPlus: boolean; items: ShopItem[];
  onToggle: (id: string) => void;
  /** Un article tapé à la main (« 2 citrons ») ; renvoie son id */
  onAdd: (item: { name: string; qty: string }) => string | null;
  /** Retire ce qui est déjà dans le panier */
  onClearDone: () => void;
}) {
  const openScan = useOpenScan();
  // Les articles qui viennent d'arriver (« Dans ta liste · voir ») s'allument un instant
  const arrived = (useLocation().state as { flash?: string[] } | null)?.flash ?? [];
  const [typed, setTyped] = useState("");
  const [mine, setMine] = useState<string[]>([]);
  const flash = [...arrived, ...mine];
  const add = () => {
    if (!typed.trim()) return;
    const id = onAdd(typedItem(typed));
    if (id) setMine(m => [...m, id]);
    setTyped("");
  };
  const list = items;
  const done = list.filter(x => x.done).length;
  const left = list.length - done;
  const text = listText(list);
  const share = async (to: "WhatsApp" | "SMS" | "copie") => {
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
        <FridgeTabs on="courses" />
      </div>
      <div className="lbody">
        <form className="fr-add" onSubmit={e => { e.preventDefault(); add(); }}>
          <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Ajouter un article (ex. 2 citrons)" aria-label="Ajouter un article" maxLength={60} enterKeyHint="done" />
          <button type="submit" aria-label="Ajouter à la liste" disabled={!typed.trim()}><Icon name="plus" /></button>
        </form>
        {list.length === 0 ? (
          <EmptyState
            art={<ArtBag />}
            title={<>Ta liste est <em>vide</em></>}
            text="Sur une recette, touche « Ajouter les manquants » : ils arrivent ici, rangés par rayon. Tu peux aussi ajouter un article au-dessus. Coche-les en faisant les courses : ils entrent dans ta cuisine."
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
