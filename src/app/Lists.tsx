// 7 · Liste de courses (étape 10), la 2e page de l'onglet « Ma cuisine ». Le planning est dans plan/.
import { useState } from "react";
import { useLocation } from "react-router";
import { Dialog, EmptyState, Icon, Pill, RoundButton, TextLink } from "../ui/components";
import type { ShopItem } from "../lib/home";
import { aisleName, byAisle, fromText, listText, typedItem } from "../lib/shopping";
import { ArtBag } from "../ui/art";
import { plural } from "./format";
import { AppTabBar } from "./AppTabBar";
import { FridgeTabs } from "./fridge/Fridge";
import { useOpenScan } from "./offline";
import { showToast } from "./toast";
import { t } from "../lib/i18n";

/** 7 · Liste de courses : les manquants des recettes, rangés par rayon. On coche en faisant les courses, on envoie la liste.
 *  Ouverte à tous depuis le 21 octobre (choix de Hugo) : Plus garde la liste de la semaine en un appui, depuis le Planning. */
export function Courses({ isPlus, items, onToggle, onRemove, onAdd, onClearDone, onClearAll }: {
  isPlus: boolean; items: ShopItem[];
  onToggle: (id: string) => void;
  /** La croix d'un article : il sort de la liste sans être acheté (Hugo, 5 novembre) */
  onRemove: (id: string) => void;
  /** Un article tapé à la main (« 2 citrons ») ; renvoie son id */
  onAdd: (item: { name: string; qty: string }) => string | null;
  /** Retire ce qui est déjà dans le panier */
  onClearDone: () => void;
  /** Vide toute la liste, cochée ou non (Hugo, 3 novembre : le bouton en haut) */
  onClearAll: () => void;
}) {
  const openScan = useOpenScan();
  // Les articles qui viennent d'arriver (« Dans ta liste · voir ») s'allument un instant
  const arrived = (useLocation().state as { flash?: string[] } | null)?.flash ?? [];
  const [typed, setTyped] = useState("");
  const [mine, setMine] = useState<string[]>([]);
  const [askClear, setAskClear] = useState(false);
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
    if (!left) { showToast(t("Tout est déjà dans le panier", "Everything is already in the basket")); return; }
    if (to === "copie") {
      try { await navigator.clipboard.writeText(text); showToast(t("Liste copiée", "List copied")); } catch { showToast(t("La liste n'a pas pu être copiée", "The list couldn't be copied")); }
      return;
    }
    const url = to === "WhatsApp" ? `https://wa.me/?text=${encodeURIComponent(text)}` : `sms:?&body=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  };
  // Le bouton du haut : le menu de partage du téléphone, sinon WhatsApp
  const shareTop = async () => {
    if (!left) { showToast(t("Tout est déjà dans le panier", "Everything is already in the basket")); return; }
    if (navigator.share) {
      try { await navigator.share({ title: t("Ma liste de courses", "My shopping list"), text }); } catch { /* annulé */ }
      return;
    }
    void share("WhatsApp");
  };

  return (
    <div className="fa fa-app" aria-label={t("Liste de courses", "Shopping list")}>
      <div className="rhead">
        <div className="row">
          <span className="label">{t("Pour la semaine", "For the week")}</span>
          {list.length > 0 && <RoundButton icon="share" label={t("Partager la liste", "Share the list")} tone="glass" onClick={shareTop} />}
        </div>
        <div>
          {list.length > 0 && <span className="label">{plural(list.length, "article", "item")}{done ? t(` · ${done} dans le panier`, ` · ${done} in the basket`) : ""}</span>}
          <h2>{t(<>Ta liste de <em>courses</em></>, <>Your <em>shopping</em> list</>)}</h2>
        </div>
        <FridgeTabs on="courses" />
      </div>
      <div className="lbody">
        <form className="fr-add" onSubmit={e => { e.preventDefault(); add(); }}>
          <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={t("Ajouter un article (ex. 2 citrons)", "Add an item (e.g. 2 lemons)")} aria-label={t("Ajouter un article", "Add an item")} maxLength={60} enterKeyHint="done" />
          <button type="submit" aria-label={t("Ajouter à la liste", "Add to the list")} disabled={!typed.trim()}><Icon name="plus" /></button>
        </form>
        {list.length === 0 ? (
          <EmptyState
            art={<ArtBag />}
            title={t(<>Ta liste est <em>vide</em></>, <>Your list is <em>empty</em></>)}
            text={t("Sur une recette, touche « Ajouter les manquants » : ils arrivent ici, rangés par rayon. Tu peux aussi ajouter un article au-dessus. Coche-les en faisant les courses : ils entrent dans ta cuisine.",
              "On a recipe, tap \"Add missing items\": they land here, sorted by aisle. You can also add an item above. Tick them off while shopping: they go into your kitchen.")}
            action={<Pill icon="cam" onClick={openScan}>{t("Scanner mon frigo", "Scan my fridge")}</Pill>}
          />
        ) : <>
          {/* En haut de la liste : retirer ce qui est coché, ou tout vider (avant, seulement les cochés, tout en bas) */}
          <div className="l-tools">
            {done > 0 && <button type="button" className="l-tool" onClick={onClearDone}><Icon name="check" />{t(`Retirer ${done > 1 ? `les ${done} cochés` : "le coché"}`, `Remove ${done} checked`)}</button>}
            <button type="button" className="l-tool l-all" onClick={() => setAskClear(true)}><Icon name="trash" />{t("Vider la liste", "Clear the list")}</button>
          </div>
          {byAisle(list).map(([aisle, group]) => (
            <div key={aisle} className="lgroup">
              <span className="label">{aisleName(aisle)}</span>
              <div className="litems">
                {group.map(it => (
                  <div key={it.id} className="lrow">
                    <button type="button" className={"litem" + (it.done ? " done" : "") + (flash.includes(it.id) ? " new" : "")}
                      aria-pressed={it.done} onClick={() => onToggle(it.id)}>
                      <span className="ck"><Icon name="check" /></span>
                      <span className="nm"><b>{it.name}</b><small>{fromText(it.from)}</small></span>
                      <span className="q">{it.qty}</span>
                    </button>
                    <button type="button" className="ldel" aria-label={t(`Retirer ${it.name} de la liste`, `Remove ${it.name} from the list`)} onClick={() => onRemove(it.id)}>
                      <Icon name="x" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="sec"><h3>{t("Envoyer la liste", "Send the list")}</h3></div>
          <div className="share-row">
            <button type="button" onClick={() => share("WhatsApp")}><Icon name="msg" />WhatsApp</button>
            <button type="button" onClick={() => share("SMS")}><Icon name="msg" />SMS</button>
            <button type="button" onClick={() => share("copie")}><Icon name="copy" />{t("Copier", "Copy")}</button>
          </div>
          <div className="drive">
            <span className="pi"><Icon name="store" /></span>
            <div><b>{t("Commander au drive", "Order for pickup")}</b><span>Leclerc, Carrefour, Monoprix</span></div>
            <span className="lockpill">{t("Bientôt", "Soon")}</span>
          </div>
        </>}
      </div>
      <Dialog open={askClear} onClose={() => setAskClear(false)} icon="trash" title={t(<>Vider ta <em>liste&nbsp;?</em></>, <>Clear your <em>list?</em></>)} label={t("Vider la liste", "Clear the list")}>
        <p>{t(`${list.length > 1 ? `Les ${list.length} articles sont retirés` : "L'article est retiré"}, cochés ou non. Ta cuisine ne change pas.`,
          `${list.length > 1 ? `All ${list.length} items are removed` : "The item is removed"}, ticked or not. Your kitchen doesn't change.`)}</p>
        <Pill block tone="danger" onClick={() => { onClearAll(); setAskClear(false); showToast(t("Liste vidée", "List cleared")); }}>{t("Tout retirer", "Remove everything")}</Pill>
        <TextLink onClick={() => setAskClear(false)}>{t("Annuler", "Cancel")}</TextLink>
      </Dialog>
      <AppTabBar active="list" isPlus={isPlus} />
    </div>
  );
}
