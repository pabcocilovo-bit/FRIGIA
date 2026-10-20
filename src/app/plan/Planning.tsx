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
import { SwapSheet } from "./sheets";
import { count, dayOf, doubled, foundOf, MEALS, options, type PlanProps, recipePath, status, toFinish } from "./week";
import "./plan.css";

export function Planning({ isPlus, week, setWeek, history, favorites, household, onAddMissing }: PlanProps & {
  household: Person[];
  /** Les manquants de plusieurs recettes dans la liste ; renvoie les articles arrivés */
  onAddMissing: (groups: { items: { name: string; qty: string }[]; from: string }[]) => string[];
}) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const [swap, setSwap] = useState<{ i: number; meal: MealKey } | null>(null);
  const days = weekDays();
  // Gratuit : un aperçu, sans semaine enregistrée
  const w = isPlus ? week : { midi: true, days: {} };
  const { n, lefts } = count(w, days);
  const fin = toFinish(history);
  const portions = isPlus ? portionsOf(household, 0) : 2;
  const create = (pick?: [number, MealKey]) => navigate("/planning/creer", { state: { pick } satisfies PlanNewState });

  // Les recettes prévues à qui il manque quelque chose (les restes n'ont rien à acheter)
  const toBuy = days.flatMap((d, i) => MEALS.map(meal => {
    const sl = dayOf(w, d.key)[meal];
    if (!sl || sl.left) return null;
    const lines = recipeLines(sl.recipe, portions * (meal === "s" && doubled(w, days, i) ? 2 : 1), foundOf(sl, history)).filter(l => !l.have);
    return lines.length ? { items: lines.map(l => ({ name: l.n, qty: l.q })), from: `${sl.recipe.title} · ${d.long.toLowerCase()}` } : null;
  })).filter(x => x !== null);
  const addAll = () => {
    if (!isPlus) { openPaywall("planning", "/planning"); return; }
    const ids = onAddMissing(toBuy);
    showToast(ids.length ? `${plural(ids.length, "article")} ajouté${ids.length > 1 ? "s" : ""} à ta liste` : "Tout est déjà dans ta liste");
    navigate("/courses", { state: { flash: ids } });
  };

  return (
    <div className="fa fa-app" aria-label="Planning de la semaine">
      <div className="rhead">
        <div className="row">
          {history[0] ? <span className="label">{sinceScan(history[0].date)}</span> : <span />}
          <span style={{ display: "flex", gap: 8 }}>
            <RoundButton icon="pencil" label="Modifier ma semaine" tone="glass" onClick={() => create()} />
            <RoundButton icon="cam" label="Nouveau scan" tone="glass" onClick={openScan} />
          </span>
        </div>
        <div><span className="label">{weekRange()}</span>
          <h2>Ta semaine, <em>sans gâchis</em></h2></div>
      </div>
      <div className="rbody">
        {!isPlus && (
          <button type="button" className="lockbar" onClick={() => openPaywall("planning", "/planning")}>
            <span><b>Fonction Plus.</b> Tu vois un aperçu.</span><LockPill>Débloquer</LockPill>
          </button>
        )}
        {fin.length > 0 && <div className="fresh"><Icon name="leaf" /><span>Ce qui se garde le moins passe en premier : {fin.slice(0, 3).join(", ").toLowerCase()}.</span></div>}
        <p className="pl-sum">{n} repas prévu{n > 1 ? "s" : ""}{lefts ? ` · ${lefts} avec les restes de la veille` : ""}</p>
        <div className="days">
          {days.map((d, i) => {
            const day = dayOf(w, d.key);
            return (
              <div key={d.key} className={"pday" + (i === 0 ? " today" : "")}>
                <span className="d"><small>{d.short}</small><b>{d.date.getDate()}</b></span>
                <div className="pms">
                  {day.off ? <div className="pm off">Pas de repas ce jour-là</div> : MEALS.map(meal => {
                    const sl = day[meal];
                    const name = meal === "m" ? "Midi" : "Soir";
                    if (!sl) return (
                      <button key={meal} type="button" className="pm empty" aria-label={`Choisir le repas du ${name.toLowerCase()}`} onClick={() => create([i, meal])}>
                        <span className="tx"><Icon name="plus" />{name} : rien de prévu · choisir</span>
                      </button>
                    );
                    const st = status(sl.recipe, foundOf(sl, history));
                    const dbl = meal === "s" && doubled(w, days, i);
                    return (
                      <div key={meal} className="pmw">
                        <button type="button" className={"pm" + (i === 0 && meal === "s" ? " now" : "")}
                          onClick={() => navigate(recipePath(sl, history), { state: { recipe: sl.recipe, servings: portions, from: "plan" } })}>
                          <Dish recipe={sl.recipe} className="plate" />
                          <span className="tx"><span className="tg">{name}</span><b>{sl.recipe.title}</b>
                            <span className="m">{sl.left ? `Restes de ${days[i - 1]?.long.toLowerCase() ?? "la veille"} soir · rien à cuisiner` : sl.recipe.time}</span>
                            {sl.left ? <span className="badge left">Zéro gâchis</span>
                              : dbl ? <Badge icon="check">Double la dose pour demain midi</Badge>
                                : i === 0 && meal === "s" ? <Badge icon="check">Ce soir</Badge>
                                  : st.warn ? <Badge tone="warn">{st.text}</Badge> : <Badge icon="check">{st.text}</Badge>}
                          </span>
                        </button>
                        <button type="button" className="pm-sw" aria-label="Remplacer ce repas"
                          onClick={() => (isPlus ? setSwap({ i, meal }) : openPaywall("planning", "/planning"))}><Icon name="redo" /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <Pill block icon="cart" className="plan-add" disabled={isPlus && !toBuy.length} onClick={addAll}>
          {toBuy.length ? `Ajouter les manquants de ${plural(toBuy.length, "recette")} à ma liste` : isPlus ? "Rien à acheter, tu as tout" : "Ajouter les manquants à ma liste"}
        </Pill>
        <button type="button" className="wk-add" onClick={() => create()}><Icon name="pencil" /><span>Modifier ma semaine</span></button>
      </div>
      <AppTabBar active="plan" isPlus={isPlus} />
      <SwapSheet at={swap} week={week} days={days} opts={options(history, favorites)} household={household}
        setWeek={setWeek} onClose={() => setSwap(null)} />
    </div>
  );
}
