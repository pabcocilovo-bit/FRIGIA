// 7 · Ma cuisine (écart maquette, demandé par Hugo les 16 et 19 octobre) : l'onglet « Courses » devient « Ma cuisine », deux pages.
// Ma cuisine (pour tous) : le frigo et les placards au même endroit, filtrés Tout, Frigo, Placards, À finir.
// Ce que les scans ont vu, les courses cochées, ce qu'on ajoute. Toucher un nom ou une quantité le change.
// Les dates (lib/shelf.ts) : estimées d'après le produit, ou la vraie date d'un appui ; proches, le produit passe en « À finir ».
// Date passée (demandé par Hugo le 22 octobre) : « Mangé » le compte comme sauvé, « Jeté » le compte dans Ton bilan.
// La liste de courses (Plus) : Lists.tsx.
import { useState } from "react";
import { useNavigate } from "react-router";
import { ItemEdit } from "./ItemEdit";
import { Chip, EmptyState, Icon, LockPill, Pill, RoundButton } from "../../ui/components";
import { ArtFridge } from "../../ui/art";
import type { Fridge, FridgeItem, Place } from "../../lib/home";
import { addItems, placeOf, qtyOf, toIngredients, undoCooked } from "../../lib/fridge";
import { joinNames, same } from "../../lib/shopping";
import { atNoon, dayWord, daysTo, dueOf, dueText, finishOf } from "../../lib/shelf";
import type { ScanSource } from "../../lib/scan";
import { AppTabBar } from "../AppTabBar";
import { plural } from "../format";
import { useOpenScan } from "../offline";
import { useOpenPaywall } from "../plus/subscription";
import { type Amount, countItem, euros } from "../scan/savings";
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

/** Les deux pages de l'onglet : Ma cuisine, Courses */
export function FridgeTabs({ on }: { on: "cuisine" | "courses" }) {
  const navigate = useNavigate();
  return (
    <div className="chips fr-tabs" role="tablist">
      <Chip ongreen on={on === "cuisine"} role="tab" aria-selected={on === "cuisine"} onClick={() => on !== "cuisine" && navigate("/cuisine", { replace: true })}>Ma cuisine</Chip>
      <Chip ongreen on={on === "courses"} role="tab" aria-selected={on === "courses"} onClick={() => on !== "courses" && navigate("/courses", { replace: true })}>
        Courses
      </Chip>
    </div>
  );
}

const QUICK: [string, number][] = [["Aujourd'hui", 0], ["Demain", 1], ["Dans 3 jours", 3], ["Dans 1 semaine", 7]];
const iso = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** La vraie date d'un produit : quelques choix rapides, ou une date ; « Sans date » revient à la date estimée.
 *  « Autre date » montre un vrai champ date et « OK » : l'iPhone ouvrait mal un champ caché, et changeait la date
 *  (en refermant tout) dès qu'on faisait tourner la roue (signalé par Hugo le 23 octobre). */
function DueEdit({ it, onDate, onClose }: { it: FridgeItem; onDate: (until: number | undefined) => void; onClose: () => void }) {
  const [today] = useState(() => iso(Date.now()));
  const [other, setOther] = useState(false);
  const [val, setVal] = useState(() => iso(it.until ?? Date.now() + 3 * DAY));
  const pick = () => { const [y, m, d] = val.split("-").map(Number); if (y) onDate(new Date(y, m - 1, d, 12).getTime()); };
  return (
    <div className="litem fr-item editing fr-due-ed" role="group" aria-label={`Date limite de ${it.name}`}>
      <div className="fr-due-h"><b>{it.name}</b><span>Date limite ?</span>
        <button type="button" className="fr-x" aria-label="Fermer" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="fr-due-ch">
        {QUICK.map(([label, d]) => <button key={d} type="button" onClick={() => onDate(atNoon(Date.now() + d * DAY))}>{label}</button>)}
        {!other && <button type="button" onClick={() => setOther(true)}>Autre date</button>}
        {it.until && <button type="button" className="fr-due-auto" onClick={() => onDate(undefined)}>Sans date</button>}
      </div>
      {other && (
        <div className="fr-due-other">
          <input type="date" aria-label="Autre date" min={today} value={val} onChange={e => setVal(e.target.value)} />
          <button type="button" disabled={!val} onClick={pick}>OK</button>
        </div>
      )}
    </div>
  );
}

function Row({ it, onFinish, onMove, onRemove, onEdit, onDate, onGone }: {
  it: FridgeItem; onFinish: () => void; onMove: () => void; onRemove: () => void; onEdit: (name: string, qty: string) => void;
  onDate: (until: number | undefined) => void; onGone: (ate: boolean) => void;
}) {
  const place = placeOf(it);
  const [editing, setEditing] = useState<"name" | "qty" | "date" | null>(null);
  const qty = qtyOf(it.qty);
  const fin = finishOf(it);
  const due = dueText(it);
  const d = dueOf(it);
  // Date passée : « Mangé » ou « Jeté » à la place de « À finir » et de la croix
  const past = !!d && daysTo(d.at) < 0;
  if (editing === "date") return <DueEdit it={it} onDate={u => { onDate(u); setEditing(null); }} onClose={() => setEditing(null)} />;
  if (editing) return (
    <div className="litem fr-item editing">
      <ItemEdit name={it.name} qty={qty} focus={editing} onSave={(n, q) => { onEdit(n, q); setEditing(null); }} onCancel={() => setEditing(null)} />
    </div>
  );
  return (
    <div className={"litem fr-item" + (fin ? " fin" : "")}>
      <span className="nm">
        <button type="button" className="fr-nm" aria-label={`Changer le nom de ${it.name}`} onClick={() => setEditing("name")}><b>{it.name}</b></button>
        <small>
          <button type="button" className={"fr-q" + (qty ? "" : " none")} aria-label={qty ? `Quantité de ${it.name} : ${qty}. Changer` : `Ajouter une quantité à ${it.name}`}
            onClick={() => setEditing("qty")}>{qty || "+ quantité"}</button>
          {" · "}
          <button type="button" className="fr-place" aria-label={`${it.name} : ${PLACE[place]}. Ranger ${place === "frigo" ? "aux placards" : "au frigo"}`} onClick={onMove}>{PLACE[place]}</button>
          {" · "}
          {/* La date (estimée ou vraie) ; touchée : la vraie date. Sans estimation au frigo : « + date » */}
          {due ? (
            <button type="button" className={"fr-due" + (due.soon ? " soon" : "")} aria-label={`${it.name} : ${due.text}. Mettre la date`} onClick={() => setEditing("date")}>{due.text}</button>
          ) : <>{`${FROM[it.from]} ${ago(it.at)}`}{place === "frigo" && <>{" · "}
            <button type="button" className="fr-due" aria-label={`Mettre la date de ${it.name}`} onClick={() => setEditing("date")}>+ date</button></>}</>}
        </small>
      </span>
      {past ? <>
        <button type="button" className="fr-gone" aria-label={`${it.name} : mangé`} onClick={() => onGone(true)}>Mangé</button>
        <button type="button" className="fr-gone" aria-label={`${it.name} : jeté`} onClick={() => onGone(false)}>Jeté</button>
      </> : <>
        <button type="button" className={"fr-fin" + (fin ? " on" : "")} aria-pressed={fin} onClick={onFinish}>À finir</button>
        <button type="button" className="fr-x" aria-label={`Retirer ${it.name}`} onClick={onRemove}><Icon name="x" /></button>
      </>}
    </div>
  );
}

export function MyKitchen({ isPlus, fridge, onFridge, onGone }: {
  isPlus: boolean; fridge: Fridge; onFridge: (f: Fridge | ((f: Fridge) => Fridge)) => void;
  /** Date passée : mangé (compte comme sauvé) ou jeté (compte dans Ton bilan), avec ce que le produit valait */
  onGone: (it: FridgeItem, ate: boolean, value: Amount) => void;
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
  const rank = (x: FridgeItem) => (finishOf(x) ? 0 : placeOf(x) === "frigo" ? 1 : 2);
  const shown = items
    .filter(x => (filter === "tout" ? true : filter === "finir" ? finishOf(x) : placeOf(x) === filter || moved.includes(x.id)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "fr"));
  const count = (f: Filter) => (f === "tout" ? items.length : f === "finir" ? items.filter(x => finishOf(x)).length : items.filter(x => placeOf(x) === f).length);
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
  // « Que cuisiner avec ? » : le frigo part tout droit sur « Qu'est-ce qu'on cuisine ? » (sans photo) ; les placards s'y ajoutent
  // (« Tes placards », après le menu). Rien au frigo : ce sont les placards qui partent.
  const cook = () => {
    const cold = fridge.items.filter(x => placeOf(x) === "frigo");
    setScan({ source: cold.length ? "frigo" : "placard", switched: null, photo: null, ingredients: toIngredients({ ...fridge, items: cold.length ? cold : fridge.items }),
      token: null, ticket: null, empty: false, merge: true, guests: 0, off: [], made: null });
    navigate("/scan/menu");
  };
  // Rien dedans : des plats quand même (Plus)
  const ideas = () => {
    if (!isPlus) { openPaywall("vide"); return; }
    setScan({ source: "frigo", switched: null, photo: null, ingredients: [], token: null, empty: true, off: [], made: null });
    navigate("/scan/menu");
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
        <FridgeTabs on="cuisine" />
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
                  // Décoché à la main : false (il ne se recoche pas tout seul)
                  onFinish={() => set(it.id, { finish: !finishOf(it) })}
                  onDate={until => {
                    // Une nouvelle date : « À finir » suit de nouveau la date
                    set(it.id, { until, finish: undefined });
                    showToast(until ? `${it.name} : date notée, ${dayWord(until)}` : `${it.name} : sans date`);
                  }}
                  onMove={() => {
                    const to: Place = placeOf(it) === "frigo" ? "placard" : "frigo";
                    set(it.id, { place: to });
                    setMoved(m => (m.includes(it.id) ? m : [...m, it.id]));
                    showToast(`${it.name} : rangé ${to === "frigo" ? "au frigo" : "aux placards"}`);
                  }}
                  onRemove={() => set(it.id, null)}
                  onGone={ate => {
                    const value = countItem(it.name, qtyOf(it.qty));
                    set(it.id, null);
                    onGone(it, ate, value);
                    showToast(ate ? (value.eur > 0 ? `${it.name} : ${euros(value.eur)} sauvés` : `${it.name} : noté, mangé`) : `${it.name} : noté, retiré de ta cuisine`);
                  }}
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
