// Les feuilles de la semaine : choisir un repas (Crée ta semaine), placer une recette (« Ajouter à ma semaine »),
// remplacer un repas (Planning, Accueil) et le plat prévu ce soir (Accueil, Plus).
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Badge, Chip, Dialog, Icon } from "../../ui/components";
import type { MealKey, Slot, Week } from "../../lib/home";
import { type Person, portionsOf, portTxt } from "../../lib/household";
import type { HistoryEntry } from "../../lib/types";
import type { WeekDay } from "../format";
import { showToast } from "../toast";
import { Stepper } from "../scan/Ingredients";
import { eatersOf, minutesOf } from "../scan/portions";
import { MAX_GUESTS, setScan, useScan } from "../scan/store";
import { Dish } from "./Dish";
import {
  dayOf, dessertKey, doubled, findTitle, foundOf, leftFor, MEAL_NAME, mealOfKey, type Option, recipePath, setSlot, slotOption, slotWhen, status, swapOrder, type SwapBy,
} from "./week";
import "../onboarding/ob.css";
import "./plan.css";
import { timeText } from "../../lib/recipes";
import { t } from "../../lib/i18n";

const lower1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** « mercredi soir », « ce soir » */
const when = slotWhen;
/** « le midi » / « lunch » */
const theMeal = (meal: MealKey) => (meal === "m" ? t("le midi", "lunch") : t("le soir", "dinner"));

/** Grande feuille du bas, avec son en-tête et sa liste qui défile. */
function Layer({ open, onClose, label, className, children }: { open: boolean; onClose: () => void; label: string; className: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return createPortal(
    <div className={"fa fa-layer" + (open ? " open" : "")} aria-hidden={!open} inert={!open}>
      <div className="scrim" onClick={onClose} />
      <div className={"sheet " + className} role="dialog" aria-modal="true" aria-label={label}>
        <span className="grab" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

type Tab = "scan" | "fav" | "ok" | "box" | "fast";

/** Crée ta semaine : « Choisis ton repas » pour une case. Les restes de la veille d'abord pour un midi. */
export function PickSheet({ at, week, days, opts, favTitles, onPick, onClose }: {
  at: { i: number; meal: MealKey } | null;
  week: Week; days: WeekDay[]; opts: Option[]; favTitles: string[];
  onPick: (slot: Slot) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("scan");
  const [chosen, setChosen] = useState<string | null>(null);
  const [last, setLast] = useState(at);
  if (at && at !== last) { setLast(at); setTab("scan"); setChosen(null); }
  const cur = last;
  const i = cur?.i ?? 0, meal = cur?.meal ?? "s";
  const d = days[i];
  const slot = cur ? dayOf(week, d.key)[meal] : undefined;
  const lf = cur && meal === "m" ? leftFor(week, days, i) : undefined;
  const tabs: [Tab, string][] = meal === "m"
    ? [["scan", t("Idées du scan", "Scan ideas")], ["fav", t("Tes favoris", "Your favorites")], ["box", t("Se mange froid", "Eaten cold")], ["fast", t("Moins de 20 min", "Under 20 min")]]
    : [["scan", t("Idées du scan", "Scan ideas")], ["fav", t("Tes favoris", "Your favorites")], ["ok", t("Tu as tout", "You have everything")], ["fast", t("Moins de 20 min", "Under 20 min")]];
  // Un plat pour la case : les desserts se placent avec « Ajouter à ma semaine »
  const list = opts.filter(o => !o.recipe.dessert).filter(o =>
    tab === "scan" ? !o.fav : tab === "fav" ? favTitles.includes(o.recipe.title) : tab === "ok" ? status(o.recipe, o.found).missing === 0
      : tab === "box" ? !!o.recipe.cold : minutesOf(o.recipe) > 0 && minutesOf(o.recipe) < 20);
  const pick = (s: Slot, id: string) => {
    setChosen(id);
    setTimeout(() => {
      onPick(s);
      showToast(`${s.left ? t("Restes : ", "Leftovers: ") : ""}${s.recipe.title} · ${t(days[i].long.toLowerCase(), days[i].long)} ${MEAL_NAME[meal]}`);
    }, 260);
  };
  const isOn = (id: string, fallback: boolean) => (chosen ? chosen === id : fallback);

  return (
    <Layer open={!!at} onClose={onClose} label={t("Choisis ton repas", "Choose your meal")} className="pn-sheet">
      <div className="pn-sh-head">
        <div><small>{d.long} {d.date.getDate()} · {theMeal(meal)}</small><h3>{slot ? t("Change de repas", "Change meal") : t("Choisis ton repas", "Choose your meal")}</h3></div>
        <button type="button" className="fg-x" aria-label={t("Fermer", "Close")} onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="chips pn-sh-chips">
        {tabs.map(([k, l]) => <Chip key={k} on={tab === k} onClick={() => setTab(k)}>{l}</Chip>)}
      </div>
      <div className="pn-sh-list">
        {lf && (
          <button type="button" className={"pn-opt left" + (isOn("left", !!slot?.left) ? " on" : "")} onClick={() => pick({ ...lf, left: true }, "left")}>
            <Dish recipe={lf.recipe} />
            <span className="tx"><span className="kick">{t("Zéro gâchis", "Zero waste")}</span><b>{t(`Les restes de ${days[i - 1].long.toLowerCase()} soir`, `Leftovers from ${days[i - 1].long}'s dinner`)}</b>
              <span>{lf.recipe.title} · {t("rien à cuisiner", "nothing to cook")}</span><Badge>{t("On double la dose la veille", "Make double the day before")}</Badge></span>
            <span className="ck"><Icon name="check" /></span>
          </button>
        )}
        {list.map(o => {
          const st = status(o.recipe, o.found);
          const other = findTitle(week, days, o.recipe.title, [d.key, meal]);
          const on = isOn(o.recipe.title, !!slot && !slot.left && slot.recipe.title === o.recipe.title);
          return (
            <button key={o.recipe.title} type="button" className={"pn-opt" + (on ? " on" : "")} onClick={() => pick(slotOption(o), o.recipe.title)}>
              <Dish recipe={o.recipe} />
              <span className="tx"><b>{o.recipe.title}</b><span>{timeText(o.recipe.time)}{tab === "box" ? t(" · se mange froid", " · eaten cold") : ""}</span>
                <Badge tone={st.warn ? "warn" : undefined}>{st.text}</Badge>
                {other && <span className="pn-used">{t("Déjà prévu", "Already planned")} {when(days, other[0], mealOfKey(other[1]))}</span>}
              </span>
              <span className="ck"><Icon name="check" /></span>
            </button>
          );
        })}
        {!list.length && !lf && (
          <p className="pn-sh-none">{tab === "scan" ? t("Pas encore d'idée cette semaine. Scanne ton frigo : ses recettes arrivent ici.", "No ideas this week yet. Scan your fridge: its recipes land here.")
            : tab === "fav" ? t("Pas encore de favori. Touche le cœur d'une recette pour la garder.", "No favorites yet. Tap a recipe's heart to keep it.")
              : t("Rien dans cette liste pour l'instant.", "Nothing in this list yet.")}</p>
        )}
      </div>
    </Layer>
  );
}

/** « Ajouter à ta semaine » : on touche une case libre (ou pleine, pour remplacer). Déjà prévue ailleurs : elle se déplace.
 *  Un dessert va avec le plat du midi ou du soir, sans le remplacer. */
export function WeekSheet({ option, week, days, setWeek, onClose }: {
  option: Option | null; week: Week; days: WeekDay[]; setWeek: (w: Week) => void; onClose: () => void;
}) {
  const navigate = useNavigate();
  const [last, setLast] = useState(option);
  if (option && option !== last) setLast(option);
  const o = last;
  const sweet = !!o?.recipe.dessert;
  const place = (i: number, meal: MealKey) => {
    if (!o) return;
    const key = sweet ? dessertKey(meal) : meal;
    const old = findTitle(week, days, o.recipe.title);
    let w = week;
    if (old && !(old[0] === i && old[1] === key)) w = setSlot(w, days, days[old[0]].key, old[1], undefined);
    setWeek(setSlot(w, days, days[i].key, key, slotOption(o)));
    onClose();
    showToast(t(`Ajouté à ta semaine · ${sweet ? "en dessert, " : ""}${days[i].long.toLowerCase()} ${MEAL_NAME[meal]}`, `Added to your week · ${sweet ? "as dessert, " : ""}${days[i].long} ${MEAL_NAME[meal]}`));
  };
  const slotBtn = (i: number, meal: MealKey) => {
    const day = dayOf(week, days[i].key), sl = day[meal];
    const tag = <span className="wk-tag">{MEAL_NAME[meal]}</span>;
    if (sweet) {
      const ds = day[dessertKey(meal)];
      if (!sl && !ds) return <button key={meal} type="button" className="wk-slot free" onClick={() => place(i, meal)}>{tag}{t("Libre", "Free")}</button>;
      const me = !!o && ds?.recipe.title === o.recipe.title;
      return (
        <button key={meal} type="button" className={"wk-slot has" + (me ? " me" : "")} onClick={() => place(i, meal)}>
          {tag}<Dish recipe={(sl ?? ds)!.recipe} /><span><b>{sl ? sl.recipe.title : t("Pas de plat", "No main")}</b>
            <i>{me ? t("Dessert déjà prévu ici", "Dessert already planned here") : ds ? t(`Dessert : ${ds.recipe.title} · remplacer`, `Dessert: ${ds.recipe.title} · replace`) : t("Toucher pour ajouter le dessert", "Tap to add the dessert")}</i></span>
        </button>
      );
    }
    if (!sl) return <button key={meal} type="button" className="wk-slot free" onClick={() => place(i, meal)}>{tag}{t("Libre", "Free")}</button>;
    const me = !!o && !sl.left && sl.recipe.title === o.recipe.title;
    return (
      <button key={meal} type="button" className={"wk-slot has" + (me ? " me" : "")} onClick={() => place(i, meal)}>
        {tag}<Dish recipe={sl.recipe} /><span><b>{sl.recipe.title}</b><i>{me ? t("Déjà prévu ici", "Already planned here") : sl.left ? t("Restes de la veille", "The day before's leftovers") : t("Toucher pour remplacer", "Tap to replace")}</i></span>
      </button>
    );
  };
  return (
    <Layer open={!!option} onClose={onClose} label={t("Ajouter à ta semaine", "Add to your week")} className="wk-sheet">
      {o && <>
        <div className="wk-head"><Dish recipe={o.recipe} /><div><small>{t("Ajouter à ta semaine", "Add to your week")}</small><h3>{o.recipe.title}</h3></div>
          <button type="button" className="fg-x" aria-label={t("Fermer", "Close")} onClick={onClose}><Icon name="x" /></button></div>
        <p className="wk-q">{sweet ? t("Avec quel repas ?", "With which meal?") : t("Quel repas ?", "Which meal?")}</p>
        <div className="wk-list">
          {days.map((d, i) => {
            const off = dayOf(week, d.key).off;
            return [
              <span key={d.key} className={"wk-day" + (i === 0 ? " today" : "")}><small>{d.short}</small><b>{d.date.getDate()}</b></span>,
              off
                ? <button key={d.key + "x"} type="button" className="wk-slot off" onClick={() => place(i, "s")}>{t("Pas de repas", "No meals")}</button>
                : <div key={d.key + "p"} className="wk-pair">{slotBtn(i, "m")}{slotBtn(i, "s")}</div>,
            ];
          })}
        </div>
        <button type="button" className="wk-see" onClick={() => { onClose(); navigate("/planning/creer"); }}>{t("Voir toute ma semaine", "See my whole week")}<Icon name="next" /></button>
      </>}
    </Layer>
  );
}

/** Le dessert d'un repas (Planning) : à côté du plat, sans le remplacer. Les idées sucrées des scans et des favoris. */
export function DessertSheet({ at, week, days, opts, setWeek, onOpen, onClose }: {
  at: { i: number; meal: MealKey } | null;
  week: Week; days: WeekDay[]; opts: Option[];
  setWeek: (w: Week) => void; onOpen: (s: Slot) => void; onClose: () => void;
}) {
  const [last, setLast] = useState(at);
  if (at && at !== last) setLast(at);
  const i = last?.i ?? 0, meal = last?.meal ?? "s";
  const key = dessertKey(meal);
  const day = last ? dayOf(week, days[i].key) : undefined;
  const ds = day?.[key];
  const list = opts.filter(o => o.recipe.dessert && o.recipe.title !== ds?.recipe.title);
  const put = (s: Slot | undefined, text: string) => { setWeek(setSlot(week, days, days[i].key, key, s)); onClose(); showToast(text); };
  return (
    <Layer open={!!at} onClose={onClose} label={t("Le dessert de ce repas", "This meal's dessert")} className="pn-sheet">
      <div className="pn-sh-head">
        <div><small>{days[i].long} {days[i].date.getDate()} · {theMeal(meal)}{day?.[meal] ? t(` · avec ${lower1(day[meal]!.recipe.title)}`, ` · with ${lower1(day[meal]!.recipe.title)}`) : ""}</small>
          <h3>{ds ? t("Ton dessert", "Your dessert") : t("Ajoute un dessert", "Add a dessert")}</h3></div>
        <button type="button" className="fg-x" aria-label={t("Fermer", "Close")} onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="pn-sh-list">
        {ds && (
          <div className="pn-opt on ds-cur">
            <Dish recipe={ds.recipe} />
            <span className="tx"><span className="kick">{t("Prévu", "Planned")}</span><b>{ds.recipe.title}</b><span>{timeText(ds.recipe.time)}</span>
              <span className="ds-act">
                <button type="button" onClick={() => { onClose(); onOpen(ds); }}>{t("Voir la recette", "See the recipe")}</button>
                <button type="button" onClick={() => put(undefined, t("Dessert retiré", "Dessert removed"))}>{t("Retirer", "Remove")}</button>
              </span></span>
          </div>
        )}
        {ds && list.length > 0 && <p className="ds-or">{t("Ou un autre dessert", "Or another dessert")}</p>}
        {list.map(o => {
          const st = status(o.recipe, o.found);
          return (
            <button key={o.recipe.title} type="button" className="pn-opt" onClick={() => put(slotOption(o), `${o.recipe.title} · ${t("en dessert", "as dessert")}, ${when(days, i, meal)}`)}>
              <Dish recipe={o.recipe} />
              <span className="tx"><b>{o.recipe.title}</b><span>{timeText(o.recipe.time)}</span><Badge tone={st.warn ? "warn" : undefined}>{st.text}</Badge></span>
              <span className="ck"><Icon name="check" /></span>
            </button>
          );
        })}
        {!list.length && !ds && (
          <p className="pn-sh-none">{t("Pas encore d'idée de dessert. Au scan, choisis « 2 plats et 1 dessert » ou « 3 desserts » : ils arrivent ici.", "No dessert ideas yet. At the scan, pick \"2 mains and 1 dessert\" or \"3 desserts\": they land here.")}</p>
        )}
      </div>
    </Layer>
  );
}

/** Remplacer un repas : trois idées à la fois, triées selon la pastille. Les restes du lendemain suivent le nouveau plat. */
export function SwapSheet({ at, week, days, opts, household, setWeek, onClose }: {
  at: { i: number; meal: MealKey } | null;
  week: Week; days: WeekDay[]; opts: Option[]; household: Person[];
  setWeek: (w: Week) => void; onClose: () => void;
}) {
  const [by, setBy] = useState<SwapBy>("frigo");
  const [off, setOff] = useState(0);
  const [sel, setSel] = useState(0);
  const [last, setLast] = useState(at);
  const car = useRef<HTMLDivElement>(null);
  if (at && at !== last) { setLast(at); setBy("frigo"); setOff(0); setSel(0); }
  const i = last?.i ?? 0, meal = last?.meal ?? "s";
  const sl = last ? dayOf(week, days[i].key)[meal] : undefined;
  const pool = swapOrder(opts.filter(o => !o.recipe.dessert && o.recipe.title !== sl?.recipe.title), by);
  const list = pool.length ? Array.from({ length: Math.min(3, pool.length) }, (_, j) => pool[(off + j) % pool.length]) : [];
  const dbl = !!sl && meal === "s" && doubled(week, days, i);
  const kids = household.some(p => p.kid);
  const reset = (fn: () => void) => { fn(); setSel(0); car.current?.scrollTo({ left: 0 }); };
  const go = () => {
    const o = list[sel];
    if (!o || !last) return;
    const ns = slotOption(o);
    let w = setSlot(week, days, days[i].key, meal, ns);
    if (dbl) w = setSlot(w, days, days[i + 1].key, "m", { ...ns, left: true });
    setWeek(w);
    onClose();
    showToast(`${i === 0 ? `Ce ${MEAL_NAME[meal]}` : `${days[i].long} ${MEAL_NAME[meal]}`} : ${lower1(o.recipe.title)}`);
  };
  const onScroll = () => {
    const el = car.current, c = el?.querySelector<HTMLElement>(".sw-card");
    if (!el || !c) return;
    setSel(Math.max(0, Math.min(list.length - 1, Math.round(el.scrollLeft / (c.offsetWidth + 12)))));
  };
  const tap = (j: number) => {
    if (j === sel) { go(); return; }
    const c = car.current?.querySelector<HTMLElement>(".sw-card");
    car.current?.scrollTo({ left: j * ((c?.offsetWidth ?? 0) + 12), behavior: "smooth" });
    setSel(j);
  };

  return (
    <Dialog open={!!at} onClose={onClose} className="sw-sheet" label={t("Remplacer ce repas", "Replace this meal")}>
      <button type="button" className="dl-x" aria-label={t("Fermer", "Close")} onClick={onClose}><Icon name="x" /></button>
      <span className="sw-d">{i === 0 ? t("Aujourd'hui", "Today") : `${days[i].long} ${days[i].date.getDate()}`} · {theMeal(meal)}</span>
      <h3>{i === 0 && meal === "s" ? t(<>Autre chose <em>ce soir&nbsp;?</em></>, <>Something else <em>tonight?</em></>) : t(<>Plutôt autre <em>chose&nbsp;?</em></>, <>Fancy something <em>else?</em></>)}</h3>
      {sl && <p className="sw-cur"><Dish recipe={sl.recipe} className="plate" /><span>{t("À la place de", "Instead of")} <b>{lower1(sl.recipe.title)}{sl.left ? t(" (les restes)", " (the leftovers)") : ""}</b></span></p>}
      <div className="chips sw-chips" role="tablist">
        <Chip on={by === "frigo"} onClick={() => reset(() => { setBy("frigo"); setOff(0); })}>{t("Mon frigo", "My fridge")}</Chip>
        <Chip on={by === "vite"} onClick={() => reset(() => { setBy("vite"); setOff(0); })}>{t("Plus rapide", "Quicker")}</Chip>
        {kids && <Chip on={by === "kids"} onClick={() => reset(() => { setBy("kids"); setOff(0); })}>{t("Enfants", "Kids")}</Chip>}
      </div>
      {list.length ? <>
        <div className="sw-car" ref={car} onScroll={onScroll}>
          {list.map((o, j) => {
            const st = status(o.recipe, o.found);
            return (
              <button key={o.recipe.title} type="button" className={"sw-card" + (j === sel ? " on" : "")} onClick={() => tap(j)}>
                <Dish recipe={o.recipe} className="plate" /><b>{o.recipe.title}</b>
                <span className="sw-m">{timeText(o.recipe.time)}{o.recipe.kids ? t(" · les enfants adorent", " · kids love it") : ""}</span>
                <Badge tone={st.warn ? "warn" : undefined} icon={st.warn ? undefined : "check"}>{st.text}</Badge>
              </button>
            );
          })}
        </div>
        <div className="sw-dots" aria-hidden="true">{list.map((_, j) => <i key={j} className={j === sel ? "on" : undefined} />)}</div>
      </> : <p className="sw-none">{t("Pas d'autre idée cette semaine. Scanne ton frigo pour en avoir de nouvelles.", "No other ideas this week. Scan your fridge for new ones.")}</p>}
      {dbl && <p className="sw-left"><Icon name="leaf" /><span>{t(`Les restes sont prévus ${days[i + 1].long.toLowerCase()} midi : ils suivront le nouveau plat. Fais-en un peu plus.`, `The leftovers are planned for ${days[i + 1].long} lunch: they'll follow the new dish. Make a bit more.`)}</span></p>}
      <button type="button" className="pill sage block" disabled={!list.length} onClick={go}>{t("Remplacer par ce plat", "Replace with this dish")}</button>
      <div className="sw-alt">
        <button type="button" className="link" disabled={pool.length <= 3} onClick={() => reset(() => setOff(x => x + 3))}><Icon name="redo" />{t("D'autres idées", "More ideas")}</button>
        <button type="button" className="link sw-keep" onClick={onClose}>{t("Garder ce plat", "Keep this dish")}</button>
      </div>
    </Dialog>
  );
}

/** Accueil (Plus) : le plat prévu ce soir. Qui mange, les invités, puis la cuisson. */
export function TonightSheet({ open, slot, history, household, label = t("Prévu ce soir", "Planned tonight"), onSwap, onClose }: {
  open: boolean; slot: Slot | undefined; history: HistoryEntry[]; household: Person[];
  /** « Prévu ce soir », « Prévu demain midi », « Le dessert de ce soir » */
  label?: string;
  /** Changer de plat (pas pour un dessert) */
  onSwap?: () => void; onClose: () => void;
}) {
  const navigate = useNavigate();
  const scan = useScan();
  const eaters = eatersOf(household, scan);
  const p = portionsOf(eaters, scan.guests);
  if (!slot) return null;
  const r = slot.recipe;
  const st = status(r, foundOf(slot, history));
  const steps = r.steps?.length ?? 0;
  const path = recipePath(slot, history);
  const toggle = (id: string) => {
    const away = scan.away.includes(id);
    if (!away && eaters.length === 1) { showToast(t("Il faut au moins une personne à table", "At least one person has to be at the table")); return; }
    setScan({ away: away ? scan.away.filter(x => x !== id) : [...scan.away, id] });
  };
  const guests = (g: number) => {
    if (g > scan.guests) showToast(g === 1 ? t("Un invité ce soir : les quantités suivent", "One guest tonight: quantities updated") : t(`${g} invités ce soir : les quantités suivent`, `${g} guests tonight: quantities updated`));
    setScan({ guests: g });
  };
  return (
    <Dialog open={open} onClose={onClose} className="tn-sheet" label={label}>
      <div className="tn-top">
        <Dish recipe={r} className="plate" />
        <div><span className="label">{label}</span><h3>{r.title}</h3><span className="tn-sm">{timeText(r.time)}{steps ? ` · ${steps} ${t("étape", "step")}${steps > 1 ? "s" : ""}` : ""}</span></div>
      </div>
      <p className={"tn-have" + (st.warn ? " warn" : "")}><Icon name={st.warn ? "cart" : "leaf"} /><span>{st.text}{st.warn ? t(" : pense à l'acheter en rentrant.", ": remember to buy it on the way home.") : "."}</span></p>
      <span className="label tn-q">{t("Qui mange ?", "Who's eating?")}</span>
      <div className="tn-who">
        {household.map(m => {
          const on = !scan.away.includes(m.id);
          return (
            <button key={m.id} type="button" className={"tn-p" + (on ? " on" : "")} aria-pressed={on} onClick={() => toggle(m.id)}>
              <i>{m.name.charAt(0).toUpperCase()}</i>{m.name}{m.kid && <small>{t(`${m.age} ans`, `${m.age} yrs`)}</small>}
            </button>
          );
        })}
      </div>
      <div className="gst tn-gst"><span className="gst-ic"><Icon name="users" /></span><div><b>{t("Des invités ?", "Guests?")}</b><small>{t("Comptés comme des adultes", "Counted as adults")}</small></div>
        <Stepper value={scan.guests} min={0} max={MAX_GUESTS} label={t(["Un invité de moins", "Un invité de plus"], ["One guest fewer", "One more guest"])} onChange={guests} />
      </div>
      <button type="button" className="gobar tn-cook" onClick={() => { onClose(); navigate(`${path}/cuisine`, { state: { recipe: r, servings: p } }); }}>
        <span><b>{t("Commencer la cuisson", "Start cooking")}</b><small>{t("Pour", "For")} {portTxt(p)} · {timeText(r.time)}</small></span>
        <span className="go"><Icon name="arrow" /></span>
      </button>
      <div className="tn-links">
        <button type="button" className="link" onClick={() => { onClose(); navigate(path, { state: { recipe: r, servings: p, from: "plan" } }); }}>{t("Voir la recette en entier", "See the full recipe")}</button>
        {onSwap && <button type="button" className="link" onClick={onSwap}>{t("Changer de plat", "Change dish")}</button>}
      </div>
    </Dialog>
  );
}
