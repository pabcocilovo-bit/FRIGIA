// Fiche recette : la photo, les chiffres, les ingrédients (quantités recalculées pour les portions) et les étapes.
// Les manquants partent dans la liste de courses (étape 10). « Lancer la cuisson » ouvre le mode cuisine pour ces portions.
import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Badge, Icon, LockPill, RoundButton } from "../../ui/components";
import type { GeneratedRecipe, HistoryEntry } from "../../lib/types";
import { useBack } from "../nav";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import { Stepper } from "./Ingredients";
import { eatersOf, haveCount, recipeLines, srvLabel } from "./portions";
import { familyBadges, type Person, portionsOf } from "../../lib/household";
import type { ShopItem, Week } from "../../lib/home";
import { weekDays } from "../format";
import { WeekSheet } from "../plan/sheets";
import { type Option, placedText } from "../plan/week";
import { inList, joinNames } from "../../lib/shopping";
import { useScan } from "./store";
import "./scan.css";

export type RecipeState = { recipe?: GeneratedRecipe; servings?: number };

export function Recipe({ history, isPlus, household, shopping, onAddMissing, week, onWeek, avatar, isFavorite, onToggleFavorite }: {
  history: HistoryEntry[]; isPlus: boolean; household: Person[]; avatar: string | null;
  week: Week; onWeek: (w: Week) => void;
  shopping: ShopItem[];
  /** Les manquants partent dans la liste de courses ; renvoie les articles arrivés */
  onAddMissing: (items: { name: string; qty: string }[], from: string) => string[];
  isFavorite: (r: GeneratedRecipe) => boolean; onToggleFavorite: (r: GeneratedRecipe) => void;
}) {
  const back = useBack();
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const { id, n } = useParams();
  const state = useLocation().state as RecipeState | null;
  const entry = id ? history.find(e => e.id === id) : undefined;
  const index = Number(n);
  const recipe = entry ? entry.recipes[index] : state?.recipe;
  const scan = useScan();
  // Plus : ceux du foyer qui mangent (« Qui mange ce soir ? »), et les invités en plus
  const eaters = eatersOf(household, scan);
  const family = portionsOf(eaters, 0);
  const base = entry?.servings ?? state?.servings ?? (isPlus ? family : 2);
  const [servings, setServings] = useState(base);
  const [tab, setTab] = useState<"ing" | "stp">("ing");
  const [done, setDone] = useState<number[]>([]);
  const [arrived, setArrived] = useState<string[]>([]);
  const [wk, setWk] = useState<Option | null>(null);
  const photo = useRecipePhoto(recipe?.title, recipe?.imageSearch);
  if (!recipe) return <Navigate to="/" replace />;

  const lines = recipeLines(recipe, servings, entry?.ingredients);
  const { have, total } = haveCount(recipe, entry?.ingredients);
  const missing = total - have;
  const steps = recipe.steps ?? [];
  const fav = isFavorite(recipe);
  const cook = () => navigate(entry ? `/recettes/${entry.id}/${index}/cuisine` : "/recette/cuisine", { state: { recipe, servings } satisfies RecipeState });
  // Ajouter à ma semaine (Plus) : la feuille « Quel repas ? »
  const days = weekDays();
  const placed = isPlus ? placedText(week, days, recipe.title) : null;
  const addToWeek = () => (isPlus
    ? setWk({ recipe, scanId: entry?.id ?? null, n: entry ? index : null, found: entry?.ingredients ?? [], fav: !entry })
    : openPaywall("planning", "/planning"));
  // Les manquants (pour ces portions) dans la liste. Déjà dedans : « Dans ta liste · voir »
  const buy = lines.filter(l => !l.have).map(l => ({ name: l.n, qty: l.q }));
  const listed = buy.length > 0 && buy.every(b => inList(shopping, b.name));
  const addMissing = () => {
    if (!isPlus) { openPaywall("courses", "/courses"); return; }
    if (listed) { navigate("/courses", { state: { flash: arrived } }); return; }
    const ids = onAddMissing(buy, recipe.title);
    setArrived(ids);
    showToast(`${joinNames(buy.map(b => b.name.charAt(0).toUpperCase() + b.name.slice(1)))} ${buy.length > 1 ? "ajoutés" : "ajouté"} à ta liste`);
  };
  // Plus : les invités du soir, comptés comme des adultes
  const guests = Math.max(0, Math.round(servings - family));
  const all = eaters.length === household.length;
  const who = (household.length > 1 && all ? (guests ? "Famille" : "Toute la famille") : eaters.map(p => p.name).join(", "))
    + (guests ? ` + ${guests} invité${guests > 1 ? "s" : ""}` : "");
  const addGuest = (d: number) => {
    const g = Math.max(0, Math.min(8, guests + d));
    setServings(family + g);
    if (d > 0) showToast(g === 1 ? "Un invité ce soir : les quantités suivent" : `${g} invités ce soir : les quantités suivent`);
  };

  return (
    <section className="fa scan-screen scr-recipe" aria-label="Fiche recette">
      <div className="scroll">
        <div className="r-hero">
          {photo ? <img src={photo} alt={recipe.title} /> : <span style={{ display: "block", height: "100%", background: "var(--surface)" }} />}
          <div className="bar2">
            <RoundButton icon="back" label="Retour" onClick={back} />
            <span style={{ display: "flex", gap: 8 }}>
              <RoundButton icon="cal" label="Ajouter à ma semaine" onClick={addToWeek} />
              <RoundButton icon="heart" label={fav ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={fav}
                style={fav ? { background: "var(--sage)", color: "var(--on)" } : undefined}
                onClick={() => onToggleFavorite({ ...recipe, scanDate: recipe.scanDate ?? entry?.date.toISOString(), savedServings: servings })} />
            </span>
          </div>
        </div>
        <div className="band r-band">
          <span className="label">{entry ? `Recette ${index + 1} sur ${entry.recipes.length} · ${recipe.diff}` : recipe.diff}</span>
          {isPlus && familyBadges(recipe).length > 0 && <span className="bbadges">{familyBadges(recipe).map(b => <Badge key={b} tone="ongreen">{b}</Badge>)}</span>}
          <h2>{recipe.title}</h2>
          <div className="stats">
            <div><b>{recipe.time}</b><span>au total</span></div>
            <div><b>{recipe.cal}</b><span>kcal / pers.</span></div>
            {total > 0 && <div><b>{have}/{total}</b><span>dans ton frigo</span></div>}
          </div>
        </div>
        <div className="r-body">
          {recipe.intro && <p className="intro">{recipe.intro}</p>}
          <button type="button" className={"wk-add" + (placed ? " done" : "")} onClick={addToWeek}>
            <Icon name={placed ? "check" : "cal"} /><span>{placed ?? "Ajouter à ma semaine"}</span>{!isPlus && <LockPill />}
          </button>
          <div className="seg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "ing"} className={tab === "ing" ? "on" : undefined} onClick={() => setTab("ing")}>Ingrédients</button>
            <button type="button" role="tab" aria-selected={tab === "stp"} className={tab === "stp" ? "on" : undefined} onClick={() => setTab("stp")}>Étapes</button>
          </div>
          {tab === "ing" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {isPlus ? (
                <div className="rg">
                  <span className="rg-avs">
                    {eaters.slice(0, 3).map(p => {
                      const pp = p.me && avatar;
                      return <span key={p.id} className={"ini" + (p.kid ? " k" : "") + (pp ? " has-pp" : "")} style={pp ? { backgroundImage: `url(${avatar})` } : undefined}>{p.name.charAt(0).toUpperCase()}</span>;
                    })}
                    {guests > 0 && <span key={guests} className="ini g pop">+{guests}</span>}
                  </span>
                  <div className="rg-tx"><b>{srvLabel(true, servings)}</b><small>{who}</small></div>
                  <span className="rg-ctl">
                    <button type="button" className="rg-minus" aria-label="Un invité de moins" hidden={!guests} onClick={() => addGuest(-1)}><Icon name="minus" /></button>
                    <button type="button" className="rg-plus" aria-label="Un invité de plus" onClick={() => addGuest(1)}>+1</button>
                  </span>
                </div>
              ) : (
                <div className="forrow"><b>Pour {srvLabel(false, servings)}</b>
                  <Stepper value={servings} min={1} max={8} label={["Moins", "Plus"]} onChange={setServings} />
                </div>
              )}
              <div className="ingbox">
                <ul className="ings">
                  {lines.map((l, i) => (
                    <li key={i} className={done.includes(i) ? "done" : undefined}>
                      <button type="button" className="ck" aria-label="Cocher" aria-pressed={done.includes(i)}
                        onClick={() => setDone(d => (d.includes(i) ? d.filter(x => x !== i) : [...d, i]))}><Icon name="check" /></button>
                      <span className="q">{l.q}</span><span className="nm">{l.n}</span>
                      {!l.have && <Badge tone="warn">À acheter</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
              {missing > 0 && (
                <button type="button" className="add" style={{ alignSelf: "flex-start" }} onClick={addMissing}>
                  <span className="rm"><Icon name="plus" /></span>
                  <span>{isPlus && listed ? "Dans ta liste · voir" : missing > 1 ? `Ajouter les ${missing} manquants à ma liste` : "Ajouter le manquant à ma liste"}</span>
                  {!isPlus && <LockPill />}
                </button>
              )}
            </div>
          ) : (
            <ol className="stepcards">
              {steps.map((s, i) => {
                const t = recipe.timers?.[i];
                return (
                  <li key={i}><span className="num">{i + 1}</span>
                    <div><p>{s}</p>{t && <span className="timer-chip"><Icon name="clock" />{t.label} · {t.min} min</span>}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
      <button type="button" className="gobar" onClick={cook}>
        <span><b>Lancer la cuisson</b><small>{recipe.time} · {steps.length} étape{steps.length > 1 ? "s" : ""}</small></span>
        <span className="go"><Icon name="arrow" /></span>
      </button>
      <WeekSheet option={wk} week={week} days={days} setWeek={onWeek} onClose={() => setWk(null)} />
    </section>
  );
}
