// Pendant que l'IA cuisine : un fouet mélange dans le saladier, les phrases disent ce qui se passe,
// et les trois cartes se remplissent une par une quand les recettes arrivent.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router";
import { Icon, RoundButton } from "../../ui/components";
import { makeRecipes, RATE_TEXT, toDetected } from "../../lib/scan";
import type { GeneratedRecipe, HistoryEntry } from "../../lib/types";
import { useRecipePhoto } from "../photo";
import { openOffline } from "../offline";
import { showToast } from "../toast";
import { getScan, madeKey, menuOf, pantryFor, setScan } from "./store";
import type { Fridge } from "../../lib/home";
import { eatersOf, portions } from "./portions";
import { apiEaters, type Person } from "../../lib/household";
import "./scan.css";
import { timeText } from "../../lib/recipes";

const ART = `<svg class="pr-svg" viewBox="0 0 300 270" aria-hidden="true">
<ellipse cx="150" cy="252" rx="98" ry="10" fill="#1E4433" opacity=".45"/>
<g class="pr-spark"><path d="M44 70 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#9FCCA4"/><path d="M252 44 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#F3F0E7"/><path d="M262 120 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#9FCCA4"/></g>
<ellipse cx="150" cy="150" rx="112" ry="27" fill="#D9D3C2"/>
<ellipse cx="150" cy="153" rx="100" ry="20" fill="#F4D58D"/>
<g transform="translate(150 153)"><g class="pr-whisk">
<g fill="none" stroke="#F3F0E7" stroke-width="3" stroke-linecap="round"><path d="M-7 -62 C-34 -20 -30 34 0 44 C30 34 34 -20 7 -62"/><path d="M-4 -62 C-18 -20 -16 34 0 44 C16 34 18 -20 4 -62"/><path d="M0 -62 V44"/></g>
<rect x="-9" y="-72" width="18" height="12" rx="3" fill="#5E9A6C"/>
<rect x="-7" y="-140" width="14" height="72" rx="7" fill="#9FCCA4"/>
<circle cx="0" cy="-131" r="3" fill="#2D5E45"/>
</g></g>
<g transform="translate(118 160)"><g class="bit" style="--dx:-26px;--d:0.0s"><circle r="7" fill="#E2553F"/><path d="M-3 -6 l3 2 3 -2" stroke="#5E9A6C" stroke-width="2" fill="none" stroke-linecap="round"/></g></g><g transform="translate(176 160)"><g class="bit" style="--dx:30px;--d:0.35s"><circle r="6.5" fill="#F08A3C"/><circle r="3" fill="#F6AE6E"/></g></g><g transform="translate(140 160)"><g class="bit" style="--dx:-10px;--d:0.7s"><circle r="5" fill="#8CC56F"/><circle cx="-1.5" cy="-1.5" r="1.5" fill="#C6E6B0"/></g></g><g transform="translate(165 160)"><g class="bit" style="--dx:14px;--d:1.05s"><path d="M-8 4 C-6 -6 4 -8 8 -6 C6 4 -2 7 -8 4 Z" fill="#5E9A6C"/><path d="M-6 3 L5 -4" stroke="#9FCCA4" stroke-width="1.2"/></g></g><g transform="translate(128 160)"><g class="bit" style="--dx:-34px;--d:1.4s"><circle r="6.5" fill="#F08A3C"/><circle r="3" fill="#F6AE6E"/></g></g><g transform="translate(182 160)"><g class="bit" style="--dx:24px;--d:1.75s"><circle r="5" fill="#8CC56F"/><circle cx="-1.5" cy="-1.5" r="1.5" fill="#C6E6B0"/></g></g>
<path d="M50 153 A100 20 0 0 0 250 153 Z" fill="#F4D58D"/>
<ellipse class="pr-ripple" cx="150" cy="154" rx="30" ry="6" fill="none" stroke="#FBE7B5" stroke-width="3.5"/>
<path d="M38 150 A112 27 0 0 0 262 150 L250 153 A100 20 0 0 1 50 153 Z" fill="#D9D3C2"/>
<path d="M38 150 A112 27 0 0 0 262 150 C262 214 214 248 150 248 C86 248 38 214 38 150 Z" fill="#F3F0E7"/>
<path d="M46 186 A108 26 0 0 0 254 186 C252 194 249 201 245 208 A104 25 0 0 1 55 208 C51 201 48 194 46 186 Z" fill="#9FCCA4"/>
<path d="M38 150 A112 27 0 0 0 262 150" fill="none" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="2"/>
</svg>`;

function Card({ recipe, i, done, from }: { recipe?: GeneratedRecipe; i: number; done: boolean; from: string }) {
  const photo = useRecipePhoto(recipe?.title, recipe?.imageSearch);
  return (
    <div className={"pc" + (done ? " done" : "")} style={{ "--d": `${0.15 + i * 0.1}s` } as CSSProperties}>
      <span className="th">{photo && <img src={photo} alt="" />}</span>
      <span className="tx"><i className="sk" /><i className="sk" /><b>{recipe?.title}</b><small>{timeText(recipe?.time)} · {from}</small></span>
      <span className="ok"><Icon name="check" /></span>
    </div>
  );
}

export function Prep({ isPlus, household, kitchen, onReady, onOutOfScans }: {
  isPlus: boolean; household: Person[];
  /** Ma cuisine : ce qu'il y a vraiment dans les placards */
  kitchen: Fridge;
  /** Les recettes sont prêtes : le scan rejoint l'historique */
  onReady: (entry: HistoryEntry) => void;
  onOutOfScans: () => void;
}) {
  const navigate = useNavigate();
  const [scan] = useState(getScan);
  const [line, setLine] = useState(0);
  const [recipes, setRecipes] = useState<GeneratedRecipe[] | null>(null);
  const [filled, setFilled] = useState(0);
  const entry = useRef<HistoryEntry | null>(null);
  const alive = useRef(true);
  const started = useRef(false);

  const n = scan.ingredients.length;
  // Frigo vide (Plus) : pas d'ingrédient, des plats avec les placards et une petite liste de courses
  const empty = isPlus && scan.empty && !n;
  const pantry = pantryFor(kitchen, { ...scan, empty });
  const menu = menuOf(scan.menu);
  const lines = empty
    ? [pantry.length ? "Je regarde ce qu'il y a dans tes placards" : "Je pars de zéro", "Je fais une petite liste de courses", `Je choisis tes ${menu.n} recettes`]
    : [`Je mélange tes ${n} ingrédient${n > 1 ? "s" : ""}`, pantry.length ? "J'ajoute ce qu'il y a dans tes placards" : "Je cherche ce qui va ensemble", `Je choisis tes ${menu.n} recettes`];

  const finish = () => {
    const e = entry.current;
    if (!e || !alive.current) return;
    entry.current = null;
    onReady(e);
    // Moins d'idées que promis (« Créer mes 3 recettes ») : on le dit, plutôt qu'un « Deux idées » sans explication
    if (e.recipes.length < menu.n) showToast(`Frigia a trouvé ${e.recipes.length} idée${e.recipes.length > 1 ? "s" : ""} qui collent à ton frigo. « D'autres idées » en cherche d'autres.`);
    // fresh : la flèche des recettes ramène à l'accueil, pas sur le menu (qui referait les recettes)
    navigate(`/recettes/${e.id}`, { replace: true, state: { fresh: true } });
  };

  useEffect(() => {
    alive.current = true;
    if (!n && !empty) return;
    const t = [setTimeout(() => setLine(1), 1100), setTimeout(() => setLine(2), 2200)];
    if (started.current) return () => { alive.current = false; t.forEach(clearTimeout); };
    started.current = true;
    const eaters = eatersOf(household, scan);
    const servings = portions(isPlus, scan, eaters);
    void makeRecipes({
      ingredients: scan.ingredients, pantry, envies: scan.envies, noShop: scan.noShop && !empty, meal: scan.meal, count: menu.n, desserts: menu.desserts, servings, token: scan.token, empty,
      eaters: isPlus ? apiEaters(eaters) : undefined,
    }).then(r => {
      if (!alive.current) return;
      if (r.status === "ok") {
        entry.current = { id: Date.now().toString(), date: new Date(), ingredients: toDetected(scan.ingredients), recipes: r.recipes, servings, meal: scan.meal };
        setScan({ made: { key: madeKey(scan), id: entry.current.id } });
        setRecipes(r.recipes);
      } else if (r.status === "quota") {
        onOutOfScans();
      } else if (r.status !== "signed-out") {
        if (!navigator.onLine) openOffline();
        else showToast(r.status === "error" && r.message ? r.message
          : r.status === "error" && r.rate ? (scan.token ? "Beaucoup de demandes cette heure-ci. Réessaie un peu plus tard." : RATE_TEXT) : "Frigia ne répond pas. Réessaie dans un instant.");
        navigate(-1);
      }
    });
    return () => { alive.current = false; t.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les recettes arrivent : les cartes se remplissent une par une, puis les recettes s'ouvrent
  useEffect(() => {
    if (!recipes) return;
    const t = [0, 600, 1200].map((ms, i) => setTimeout(() => setFilled(i + 1), ms));
    t.push(setTimeout(finish, 2100));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes]);

  if (!n && !empty) return <Navigate to="/scan" replace />;

  return (
    <section className="fa scan-screen scr-prep" aria-label="Recettes en préparation" onClick={() => { if (recipes) finish(); }}>
      <div className="pr-top"><RoundButton icon="x" label="Annuler" tone="glass" onClick={e => { e.stopPropagation(); navigate(-1); }} /></div>
      <div className="pr-main">
        <div className="pr-art" dangerouslySetInnerHTML={{ __html: ART }} />
        <h2>Ça mijote<em>…</em></h2>
        <p className="pr-sub" aria-live="polite"><span key={line} className="swap">{lines[line]}</span></p>
        <div className="pr-dots">{[0, 1, 2].map(i => <i key={i} className={i <= line ? "on" : undefined} />)}</div>
      </div>
      <div className="pr-cards">
        {Array.from({ length: recipes?.length || menu.n }, (_, i) => i).map(i => <Card key={i} i={i} recipe={recipes?.[i]} done={filled > i} from={!empty ? (recipes?.[i]?.items?.some(x => !x.have) ? "avec un peu de courses" : "avec ton frigo") : pantry.length ? "avec tes placards" : "avec quelques courses"} />)}
      </div>
    </section>
  );
}
