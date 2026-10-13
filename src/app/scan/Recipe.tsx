// Fiche recette : la photo, les chiffres, les ingrédients (quantités recalculées pour les portions) et les étapes.
// Les manquants partent dans la liste de courses (étape 10). « Lancer la cuisson » ouvre le mode cuisine pour ces portions.
import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Badge, Icon, LockPill, RoundButton } from "../../ui/components";
import type { GeneratedRecipe, HistoryEntry } from "../../lib/types";
import { useBack } from "../nav";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import { comingSoon, showToast } from "../toast";
import { Stepper } from "./Ingredients";
import { haveCount, recipeLines, srvLabel } from "./portions";
import "./scan.css";

export type RecipeState = { recipe?: GeneratedRecipe; servings?: number };

export function Recipe({ history, isPlus, name, avatar, isFavorite, onToggleFavorite }: {
  history: HistoryEntry[]; isPlus: boolean; name: string; avatar: string | null;
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
  const base = entry?.servings ?? state?.servings ?? (isPlus ? 1 : 2);
  const [servings, setServings] = useState(base);
  const [tab, setTab] = useState<"ing" | "stp">("ing");
  const [done, setDone] = useState<number[]>([]);
  const photo = useRecipePhoto(recipe?.title, recipe?.imageSearch);
  if (!recipe) return <Navigate to="/" replace />;

  const lines = recipeLines(recipe, servings, entry?.ingredients);
  const { have, total } = haveCount(recipe, entry?.ingredients);
  const missing = total - have;
  const steps = recipe.steps ?? [];
  const fav = isFavorite(recipe);
  const cook = () => navigate(entry ? `/recettes/${entry.id}/${index}/cuisine` : "/recette/cuisine", { state: { recipe, servings } satisfies RecipeState });
  const addToWeek = () => (isPlus ? comingSoon(10) : openPaywall("planning", "/planning"));
  const addMissing = () => (isPlus ? comingSoon(10) : openPaywall("courses", "/courses"));
  // Plus : toi, et les invités du soir (comptés comme des adultes)
  const guests = Math.max(0, servings - 1);
  const addGuest = (d: number) => {
    const g = Math.max(0, Math.min(8, guests + d));
    setServings(1 + g);
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
          <h2>{recipe.title}</h2>
          <div className="stats">
            <div><b>{recipe.time}</b><span>au total</span></div>
            <div><b>{recipe.cal}</b><span>kcal / pers.</span></div>
            {total > 0 && <div><b>{have}/{total}</b><span>dans ton frigo</span></div>}
          </div>
        </div>
        <div className="r-body">
          {recipe.intro && <p className="intro">{recipe.intro}</p>}
          <button type="button" className="wk-add" onClick={addToWeek}><Icon name="cal" /><span>Ajouter à ma semaine</span>{!isPlus && <LockPill />}</button>
          <div className="seg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "ing"} className={tab === "ing" ? "on" : undefined} onClick={() => setTab("ing")}>Ingrédients</button>
            <button type="button" role="tab" aria-selected={tab === "stp"} className={tab === "stp" ? "on" : undefined} onClick={() => setTab("stp")}>Étapes</button>
          </div>
          {tab === "ing" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {isPlus ? (
                <div className="rg">
                  <span className="rg-avs">
                    <span className={"ini" + (avatar ? " has-pp" : "")} style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{name.charAt(0).toUpperCase()}</span>
                    {guests > 0 && <span key={guests} className="ini g pop">+{guests}</span>}
                  </span>
                  <div className="rg-tx"><b>{srvLabel(true, servings)}</b><small>{name}{guests ? ` + ${guests} invité${guests > 1 ? "s" : ""}` : ""}</small></div>
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
                  <span>{missing > 1 ? `Ajouter les ${missing} manquants à ma liste` : "Ajouter le manquant à ma liste"}</span>
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
    </section>
  );
}
