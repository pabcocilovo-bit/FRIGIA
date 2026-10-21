// 7 · Ma cuisine (écart maquette, demandé par Hugo les 16 et 19 octobre) : l'onglet « Courses » devient « Ma cuisine », deux pages.
// Ma cuisine (pour tous) : le frigo et les placards au même endroit, filtrés Tout, Frigo, Placards, À finir.
// Ce que les scans ont vu, les courses cochées, ce qu'on ajoute. Toucher un nom ou une quantité le change.
// La liste de courses (Plus) : Lists.tsx.
import { useState } from "react";
import { useNavigate } from "react-router";
import { ItemEdit } from "./ItemEdit";
import { Chip, EmptyState, Icon, LockPill, Pill, RoundButton } from "../../ui/components";
import { ArtFridge } from "../../ui/art";
import type { Fridge, FridgeItem, Place } from "../../lib/home";
import { addItems, placeOf, qtyOf, toIngredients, undoCooked } from "../../lib/fridge";
import { joinNames, same } from "../../lib/shopping";
import type { ScanSource } from "../../lib/scan";
import { AppTabBar } from "../AppTabBar";
import { plural } from "../format";
import { useOpenScan } from "../offline";
import { useOpenPaywall } from "../plus/subscription";
import { setScan } from "../scan/store";
import { showToast } from "../toast";
import "../scan/scan.css";
import "./fridge.css";

const DAY = 864e5;
const daysSince = (at: number) => Math.max(0, Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY));
const ago = (at: number) => { const d = daysSince(at); return d === 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} jours`; };
const FROM: Record<FridgeItem["from"], string> = { scan: "vu", courses: "acheté", main: "ajouté" };
const PLACE: Record<Place, string> = { frigo: "Frigo", placard: "Placards" };

type Filter = "tout" | Place | "finir";
const FILTERS: [Filter, string][] = [["tout", "Tout"], ["frigo", "Frigo"], ["placard", "Placards"], ["finir", "À finir"]];

// Les placards se scannent rarement : ce qu'on y a presque toujours, à ajouter d'un geste
const BASICS: [string, string][] = [
  ["Pâtes", "500 g"], ["Riz", "1 paquet"], ["Huile d'olive", "1 bouteille"], ["Farine", "1 paquet"], ["Sucre", "1 paquet"],
  ["Tomates en conserve", "1 boîte"], ["Lentilles", "1 sachet"], ["Oignons", "3"], ["Pommes de terre", "1 kg"], ["Thon en boîte", "1 boîte"],
];

/** Les deux pages de l'onglet : Ma cuisine, Courses (cadenas en Gratuit) */
export function FridgeTabs({ on, isPlus }: { on: "cuisine" | "courses"; isPlus: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="chips fr-tabs" role="tablist">
      <Chip ongreen on={on === "cuisine"} role="tab" aria-selected={on === "cuisine"} onClick={() => on !== "cuisine" && navigate("/cuisine", { replace: true })}>Ma cuisine</Chip>
      <Chip ongreen on={on === "courses"} role="tab" aria-selected={on === "courses"} onClick={() => on !== "courses" && navigate("/courses", { replace: true })}>
        Courses{!isPlus && <Icon name="lock" />}
      </Chip>
    </div>
  );
}

function Row({ it, onFinish, onMove, onRemove, onEdit }: {
  it: FridgeItem; onFinish: () => void; onMove: () => void; onRemove: () => void; onEdit: (name: string, qty: string) => void;
}) {
  const place = placeOf(it);
  const [editing, setEditing] = useState<"name" | "qty" | null>(null);
  const qty = qtyOf(it.qty);
  if (editing) return (
    <div className="litem fr-item editing">
      <ItemEdit name={it.name} qty={qty} focus={editing} onSave={(n, q) => { onEdit(n, q); setEditing(null); }} onCancel={() => setEditing(null)} />
    </div>
  );
  return (
    <div className={"litem fr-item" + (it.finish ? " fin" : "")}>
      <span className="nm">
        <button type="button" className="fr-nm" aria-label={`Changer le nom de ${it.name}`} onClick={() => setEditing("name")}><b>{it.name}</b></button>
        <small>
          <button type="button" className={"fr-q" + (qty ? "" : " none")} aria-label={qty ? `Quantité de ${it.name} : ${qty}. Changer` : `Ajouter une quantité à ${it.name}`}
            onClick={() => setEditing("qty")}>{qty || "+ quantité"}</button>
          {" · "}
          <button type="button" className="fr-place" aria-label={`${it.name} : ${PLACE[place]}. Ranger ${place === "frigo" ? "aux placards" : "au frigo"}`} onClick={onMove}>{PLACE[place]}</button>
          {` · ${FROM[it.from]} ${ago(it.at)}`}
        </small>
      </span>
      <button type="button" className={"fr-fin" + (it.finish ? " on" : "")} aria-pressed={!!it.finish} onClick={onFinish}>À finir</button>
      <button type="button" className="fr-x" aria-label={`Retirer ${it.name}`} onClick={onRemove}><Icon name="x" /></button>
    </div>
  );
}

export function MyKitchen({ isPlus, fridge, onFridge }: {
  isPlus: boolean; fridge: Fridge; onFridge: (f: Fridge | ((f: Fridge) => Fridge)) => void;
}) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const [filter, setFilter] = useState<Filter>("tout");
  // Rangé ailleurs depuis ce filtre : reste affiché (avec sa nouvelle place) jusqu'au prochain filtre, pour pouvoir revenir
  const [moved, setMoved] = useState<string[]>([]);
  const pick = (f: Filter) => { setFilter(f); setMoved([]); };
  const [name, setName] = useState("");
  const items = fridge.items;
  const old = fridge.seen != null && daysSince(fridge.seen) > 5;
  // La dernière recette cuisinée, les deux derniers jours : ce qu'elle a retiré, et « Remettre »
  const cooked = fridge.cooked && daysSince(fridge.cooked.at) <= 1 ? fridge.cooked : null;

  // « À finir » d'abord, puis le frigo, puis les placards
  const rank = (x: FridgeItem) => (x.finish ? 0 : placeOf(x) === "frigo" ? 1 : 2);
  const shown = items
    .filter(x => (filter === "tout" ? true : filter === "finir" ? x.finish : placeOf(x) === filter || moved.includes(x.id)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "fr"));
  const count = (f: Filter) => (f === "tout" ? items.length : f === "finir" ? items.filter(x => x.finish).length : items.filter(x => placeOf(x) === f).length);
  const basics = BASICS.filter(([n]) => !items.some(x => same(x.name, n)));
  const showBasics = (filter === "tout" || filter === "placard") && items.length > 0 && count("placard") < 4 && basics.length > 0;

  const set = (id: string, patch: Partial<FridgeItem> | null) =>
    onFridge(f => ({ ...f, items: patch ? f.items.map(x => (x.id === id ? { ...x, ...patch } : x)) : f.items.filter(x => x.id !== id) }));
  const add = () => {
    if (!name.trim()) return;
    // Sur le filtre Frigo ou Placards, le produit y est rangé ; sinon, d'après son nom
    onFridge(f => addItems(f, [{ name, qty: "" }], "main", filter === "frigo" || filter === "placard" ? { place: filter } : {}));
    setName("");
  };
  const scan = (source: ScanSource) => { setScan({ source }); openScan(); };
  // « Que cuisiner avec ? » : les produits passent dans « C'est bien ça ? », sans photo
  const cook = () => {
    setScan({ source: "frigo", switched: null, photo: null, ingredients: toIngredients(fridge), token: null, empty: false, merge: true, guests: 0 });
    navigate("/scan/ingredients");
  };
  // Rien dedans : des plats quand même (Plus)
  const ideas = () => {
    if (!isPlus) { openPaywall("vide"); return; }
    setScan({ source: "frigo", switched: null, photo: null, ingredients: [], token: null, empty: true });
    navigate("/scan/preparation");
  };

  return (
    <div className="fa fa-app" aria-label="Ma cuisine">
      <div className="rhead">
        <div className="row">
          <span className="label">{items.length ? `${plural(items.length, "produit")} disponible${items.length > 1 ? "s" : ""}` : "Rien pour l'instant"}</span>
          <RoundButton icon="cam" label="Scanner" tone="glass" onClick={openScan} />
        </div>
        <div>
          <h2>Ma <em>cuisine</em></h2>
          <p className="fr-sub">Ton frigo et tes placards au même endroit.</p>
        </div>
        <FridgeTabs on="cuisine" isPlus={isPlus} />
      </div>
      <div className="lbody">
        {cooked && (
          <div className="fr-note">
            <span><b>{cooked.title}</b> · retiré de ta cuisine : {joinNames(cooked.items.map(x => x.name)).toLowerCase()}.</span>
            <button type="button" className="link" onClick={() => onFridge(undoCooked)}>Remettre</button>
          </div>
        )}
        {items.length === 0 ? <>
          <EmptyState
            art={<ArtFridge />}
            title={<>Ta cuisine est <em>vide</em></>}
            text="Scanne ton frigo et tes placards : ce que Frigia voit arrive ici. Tes courses cochées aussi."
            action={<Pill icon="cam" onClick={() => scan("frigo")}>Scanner mon frigo</Pill>}
          />
          <button type="button" className="pill line block" onClick={() => scan("placard")}>Scanner mes placards</button>
          <button type="button" className="sf-empty fr-ideas" onClick={ideas}>
            <span className="ico"><Icon name="sparkle" /></span>
            <span className="tx"><b>Rien dedans ?</b>3 plats avec le placard, et une petite liste de courses</span>
            {isPlus ? <Icon name="next" className="muted" /> : <LockPill />}
          </button>
        </> : <>
          <div className="chips fr-filters" role="tablist" aria-label="Filtrer">
            {FILTERS.map(([f, label]) => (
              <Chip key={f} on={filter === f} role="tab" aria-selected={filter === f} onClick={() => pick(f)}>
                {label}{f !== "tout" && count(f) > 0 && <span className="n">{count(f)}</span>}
              </Chip>
            ))}
          </div>
          {old && filter !== "placard" && <p className="fr-old">Frigo vu il y a {daysSince(fridge.seen!)} jours. Rescanne-le pour le mettre à jour.</p>}
          {shown.length > 0 ? (
            <div className="litems">
              {shown.map(it => (
                <Row key={it.id} it={it}
                  onFinish={() => set(it.id, { finish: !it.finish || undefined })}
                  onMove={() => {
                    const to: Place = placeOf(it) === "frigo" ? "placard" : "frigo";
                    set(it.id, { place: to });
                    setMoved(m => (m.includes(it.id) ? m : [...m, it.id]));
                    showToast(`${it.name} : rangé ${to === "frigo" ? "au frigo" : "aux placards"}`);
                  }}
                  onRemove={() => set(it.id, null)}
                  onEdit={(name, qty) => set(it.id, { name, qty })} />
              ))}
            </div>
          ) : (
            <p className="fr-none">
              {filter === "finir" ? "Rien à finir. Touche « À finir » sur ce qui se garde le moins : les recettes l'utilisent en premier."
                : filter === "placard" ? "Rien aux placards pour l'instant." : "Rien au frigo pour l'instant."}
              {filter !== "finir" && <> <button type="button" className="link" onClick={() => scan(filter === "placard" ? "placard" : "frigo")}>{filter === "placard" ? "Scanner mes placards" : "Scanner mon frigo"}</button></>}
            </p>
          )}
          {showBasics && (
            <div className="fr-basics">
              <span className="label">Dans tes placards ?</span>
              <div className="fr-chips">
                {basics.slice(0, 8).map(([n, q]) => (
                  <button key={n} type="button" onClick={() => onFridge(f => addItems(f, [{ name: n, qty: q }], "main", { place: "placard" }))}>
                    <Icon name="plus" />{n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>}
        <form className="fr-add" onSubmit={e => { e.preventDefault(); add(); }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={filter === "placard" ? "Ajouter aux placards" : filter === "frigo" ? "Ajouter au frigo" : "Ajouter un produit"}
            aria-label="Ajouter un produit" maxLength={60} enterKeyHint="done" />
          <button type="submit" aria-label="Ajouter" disabled={!name.trim()}><Icon name="plus" /></button>
        </form>
        {items.length > 0 && <Pill block icon="sparkle" className="fr-cook" onClick={cook}>Que cuisiner avec ?</Pill>}
      </div>
      <AppTabBar active="list" isPlus={isPlus} />
    </div>
  );
}
