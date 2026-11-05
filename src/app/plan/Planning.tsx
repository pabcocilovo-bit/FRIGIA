// 8 · Planning (prototype V3) : la semaine créée dans « Crée ta semaine ». Chaque repas s'ouvre ou se remplace,
// une case vide renvoie vers « Crée ta semaine », et les manquants des recettes partent dans la liste de courses.
import { useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Icon, LockPill, Pill, RoundButton } from "../../ui/components";
import type { MealKey } from "../../lib/home";
import { type Person, portionsOf } from "../../lib/household";
import { AppTabBar } from "../AppTabBar";
import { plural, sinceScan, weekDays, weekRange } from "../format";
import { useOpenScan } from "../offline";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import { recipeLines } from "../scan/portions";
import { Dish } from "./Dish";
import type { PlanNewState } from "./PlanNew";
import { useSlotDrag } from "./drag";
import { DessertSheet, SwapSheet } from "./sheets";
import { count, dayOf, dessertKey, doubled, foundOf, leftFrom, MEALS, moveSlot, options, type PlanProps, recipePath, slotWhen, status, toFinish } from "./week";
import { t } from "../../lib/i18n";
import "./plan.css";
import { timeText } from "../../lib/recipes";

export function Planning({ isPlus, week, setWeek, history, favorites, household, onAddMissing }: PlanProps & {
  household: Person[];
  /** Les manquants de plusieurs recettes dans la liste ; renvoie les articles arrivés */
  onAddMissing: (groups: { items: { name: string; qty: string }[]; from: string }[]) => string[];
}) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const [swap, setSwap] = useState<{ i: number; meal: MealKey } | null>(null);
  const [sweetAt, setSweetAt] = useState<{ i: number; meal: MealKey } | null>(null);
  const days = weekDays();
  // Gratuit : un aperçu, sans semaine enregistrée
  const w = isPlus ? week : { midi: true, days: {} };
  const { n, lefts } = count(w, days);
  const fin = toFinish(history);
  const portions = isPlus ? portionsOf(household, 0) : 2;
  // Glisser un plat sur une autre case : il prend sa place, l'autre plat (s'il y en a un) part dans la case de départ
  const { drag, handle } = useSlotDrag(isPlus, (from, to) => {
    const at = (i: number, m: MealKey) => slotWhen(days, i, m);
    const other = dayOf(week, days[to.i].key)[to.meal];
    const next = moveSlot(week, days, [from.i, from.meal], [to.i, to.meal]);
    const lost = count(week, days).n - count(next, days).n;
    setWeek(next);
    navigator.vibrate?.(8);
    showToast(`${other ? t(`Échangé avec ${at(to.i, to.meal)}`, `Swapped with ${at(to.i, to.meal)}`) : t(`Déplacé à ${at(to.i, to.meal)}`, `Moved to ${at(to.i, to.meal)}`)}${lost > 0 ? t(" · les restes du lendemain sont retirés", " · the next day's leftovers are removed") : ""}`);
  });
  const lifted = drag && dayOf(w, days[drag.from.i].key)[drag.from.meal];
  const create = (pick?: [number, MealKey]) => navigate("/planning/creer", { state: { pick } satisfies PlanNewState });

  // Les recettes prévues à qui il manque quelque chose (les restes n'ont rien à acheter)
  const toBuy = days.flatMap((d, i) => MEALS.flatMap(m => [m, dessertKey(m)] as const).map(meal => {
    const sl = dayOf(w, d.key)[meal];
    if (!sl || sl.left) return null;
    const lines = recipeLines(sl.recipe, portions * (meal === "s" && doubled(w, days, i) ? 2 : 1), foundOf(sl, history)).filter(l => !l.have);
    return lines.length ? { items: lines.map(l => ({ name: l.n, qty: l.q })), from: `${sl.recipe.title} · ${t(d.long.toLowerCase(), d.long)}` } : null;
  })).filter(x => x !== null);
  const addAll = () => {
    if (!isPlus) { openPaywall("planning", "/planning"); return; }
    const ids = onAddMissing(toBuy);
    showToast(ids.length ? t(`${plural(ids.length, "article")} ajouté${ids.length > 1 ? "s" : ""} à ta liste`, `${plural(ids.length, "article", "item")} added to your list`) : t("Tout est déjà dans ta liste", "Everything's already in your list"));
    navigate("/courses", { state: { flash: ids } });
  };

  return (
    <div className="fa fa-app" aria-label={t("Planning de la semaine", "Week planner")}>
      <div className="rhead">
        <div className="row">
          {history[0] ? <span className="label">{sinceScan(history[0].date)}</span> : <span />}
          <span style={{ display: "flex", gap: 8 }}>
            <RoundButton icon="pencil" label={t("Modifier ma semaine", "Edit my week")} tone="glass" onClick={() => create()} />
            <RoundButton icon="cam" label={t("Nouveau scan", "New scan")} tone="glass" onClick={openScan} />
          </span>
        </div>
        <div><span className="label">{weekRange()}</span>
          <h2>{t(<>Ta semaine, <em>sans gâchis</em></>, <>Your week, <em>zero waste</em></>)}</h2></div>
      </div>
      <div className="rbody">
        {!isPlus && (
          <button type="button" className="lockbar" onClick={() => openPaywall("planning", "/planning")}>
            <span>{t(<><b>Fonction Plus.</b> Tu vois un aperçu.</>, <><b>A Plus feature.</b> You're seeing a preview.</>)}</span><LockPill>{t("Débloquer", "Unlock")}</LockPill>
          </button>
        )}
        {fin.length > 0 && <div className="fresh"><Icon name="leaf" /><span>{t("Ce qui se garde le moins passe en premier : ", "What keeps the least goes first: ")}{fin.slice(0, 3).join(", ").toLowerCase()}.</span></div>}
        <p className="pl-sum">{t(`${n} repas prévu${n > 1 ? "s" : ""}`, `${n} meal${n > 1 ? "s" : ""} planned`)}{lefts ? t(` · ${lefts} avec les restes de la veille`, ` · ${lefts} with the day before's leftovers`) : ""}
          {isPlus && n > 0 && <small>{t("Maintiens un plat pour le changer de jour.", "Press and hold a dish to move it to another day.")}</small>}</p>
        <div className="days">
          {days.map((d, i) => {
            const day = dayOf(w, d.key);
            return (
              <div key={d.key} className={"pday" + (i === 0 ? " today" : "") + (drag ? " dragging" : "")}>
                <span className="d"><small>{d.short}</small><b>{d.date.getDate()}</b></span>
                <div className="pms">
                  {day.off ? <div className="pm off">{t("Pas de repas ce jour-là", "No meals that day")}</div> : MEALS.map(meal => {
                    const sl = day[meal], ds = day[dessertKey(meal)];
                    const name = meal === "m" ? t("Midi", "Lunch") : t("Soir", "Dinner");
                    // Le dessert, à côté du plat : sa photo, ou « + Dessert » pour en ajouter un
                    const sweet = (sl || ds) && (
                      <button type="button" className={"pm-dt" + (ds ? " has" : "")} aria-label={ds ? t(`Dessert : ${ds.recipe.title}`, `Dessert: ${ds.recipe.title}`) : t(`Ajouter un dessert au ${name.toLowerCase()}`, `Add a dessert to ${name.toLowerCase()}`)}
                        onClick={() => (isPlus ? setSweetAt({ i, meal }) : openPaywall("planning", "/planning"))}>
                        {ds ? <Dish recipe={ds.recipe} className="plate" /> : <span className="dt-add"><Icon name="plus" /></span>}
                        <small>Dessert</small>
                      </button>
                    );
                    const target = drag && drag.over?.i === i && drag.over.meal === meal && !(drag.from.i === i && drag.from.meal === meal);
                    const drop = { "data-drop": `${i}:${meal}` };
                    if (!sl) return (
                      <div key={meal} className={"pmrow" + (target ? " drop-on" : "")} {...drop}>
                        <button type="button" className="pm empty" aria-label={t(`Choisir le repas du ${name.toLowerCase()}`, `Choose the ${name.toLowerCase()}`)} onClick={() => create([i, meal])}>
                          <span className="tx"><Icon name="plus" />{t(`${name} : rien de prévu · choisir`, `${name}: nothing planned · choose`)}</span>
                        </button>
                        {sweet}
                      </div>
                    );
                    const st = status(sl.recipe, foundOf(sl, history));
                    const dbl = meal === "s" && doubled(w, days, i);
                    return (
                      <div key={meal} className={"pmrow" + (target ? " drop-on" : "")} {...drop}>
                      <div className={"pmw" + (drag?.from.i === i && drag.from.meal === meal ? " lift" : "")} {...handle({ i, meal })}>
                        <button type="button" className={"pm" + (i === 0 && meal === "s" ? " now" : "")}
                          onClick={() => navigate(recipePath(sl, history), { state: { recipe: sl.recipe, servings: portions, from: "plan" } })}>
                          <Dish recipe={sl.recipe} className="plate" />
                          <span className="tx"><span className="tg">{name}</span><b>{sl.recipe.title}</b>
                            <span className="m">{sl.left ? `${leftFrom(days, i)} · ${t("rien à cuisiner", "nothing to cook")}` : timeText(sl.recipe.time)}</span>
                            {sl.left ? <span className="badge left">{t("Zéro gâchis", "Zero waste")}</span>
                              : dbl ? <Badge icon="check">{t("Double la dose pour demain midi", "Make double for tomorrow's lunch")}</Badge>
                                : i === 0 && meal === "s" ? <Badge icon="check">{t("Ce soir", "Tonight")}</Badge>
                                  : st.warn ? <Badge tone="warn">{st.text}</Badge> : <Badge icon="check">{st.text}</Badge>}
                          </span>
                        </button>
                        <button type="button" className="pm-sw" aria-label={t("Remplacer ce repas", "Replace this meal")}
                          onClick={() => (isPlus ? setSwap({ i, meal }) : openPaywall("planning", "/planning"))}><Icon name="redo" /></button>
                      </div>
                      {sweet}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <Pill block icon="cart" className="plan-add" disabled={isPlus && !toBuy.length} onClick={addAll}>
          {toBuy.length ? t(`Ajouter les manquants de ${plural(toBuy.length, "recette")} à ma liste`, `Add what's missing for ${plural(toBuy.length, "recette", "recipe")} to my list`) : isPlus ? t("Rien à acheter, tu as tout", "Nothing to buy, you have everything") : t("Ajouter les manquants à ma liste", "Add what's missing to my list")}
        </Pill>
        <button type="button" className="wk-add" onClick={() => create()}><Icon name="pencil" /><span>{t("Modifier ma semaine", "Edit my week")}</span></button>
      </div>
      {drag && lifted && (
        <div className="pm-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <Dish recipe={lifted.recipe} className="plate" /><b>{lifted.recipe.title}</b>
        </div>
      )}
      <AppTabBar active="plan" isPlus={isPlus} />
      <SwapSheet at={swap} week={week} days={days} opts={options(history, favorites)} household={household}
        setWeek={setWeek} onClose={() => setSwap(null)} />
      <DessertSheet at={sweetAt} week={week} days={days} opts={options(history, favorites)} setWeek={setWeek} onClose={() => setSweetAt(null)}
        onOpen={ds => navigate(recipePath(ds, history), { state: { recipe: ds.recipe, servings: portions, from: "plan" } })} />
    </div>
  );
}
