// Explorer (V3, maquette de Hugo du 25 octobre) : chercher une recette, avec ou sans frigo plein.
// Première version : la recherche parcourt les recettes de la semaine, tes favoris et les recettes de tes scans.
// À venir : une recette demandée par son nom (« tartiflette ») et ses variantes (plus healthy, sans crème…).
import { type FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "../ui/components";
import type { GeneratedRecipe, HistoryEntry } from "../lib/types";
import type { Fridge } from "../lib/home";
import { AppTabBar } from "./AppTabBar";
import { GreenHead } from "./GreenHead";
import { weekRecipes } from "./featured";
import { useRecipePhoto } from "./photo";
import { minutesOf } from "./scan/portions";
import { plural } from "./format";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = (r: GeneratedRecipe) => [r.title, ...(r.items?.map(i => i.name) ?? r.recipeIngredients?.map(i => i.name) ?? [])].join(" ");

function Card({ recipe, fav, onOpen }: { recipe: GeneratedRecipe; fav: boolean; onOpen: () => void }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  return (
    <button type="button" className="ex-card" onClick={onOpen}>
      <span className="ex-img">{photo ? <img src={photo} alt="" loading="lazy" /> : null}{fav && <span className="sp-heart" aria-label="Favori"><Icon name="heart-f" /></span>}</span>
      <b>{recipe.title}</b>
      <span>{recipe.time}{recipe.diff ? ` · ${recipe.diff}` : ""}</span>
    </button>
  );
}

export function Explore({ isPlus, history, favorites, kitchen, onOpenRecipe }: {
  isPlus: boolean; history: HistoryEntry[]; favorites: GeneratedRecipe[]; kitchen: Fridge;
  onOpenRecipe: (r: GeneratedRecipe) => void;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const week = useMemo(() => weekRecipes(kitchen.items).map(x => x.recipe), [kitchen.items]);
  // Toutes les recettes connues, sans doublon : la semaine, les favoris, puis les scans
  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...week, ...favorites, ...history.flatMap(e => e.recipes)].filter(r => !seen.has(r.title) && !!seen.add(r.title));
  }, [week, favorites, history]);
  const isFav = (r: GeneratedRecipe) => favorites.some(f => f.title === r.title);
  const query = norm(q.trim());
  const found = query ? all.filter(r => norm(words(r)).includes(query)) : [];
  const quick = all.filter(r => minutesOf(r) > 0 && minutesOf(r) <= 20);
  const submit = (e: FormEvent) => { e.preventDefault(); navigate(q.trim() ? `/explorer?q=${encodeURIComponent(q.trim())}` : "/explorer", { replace: true }); };

  return (
    <div className="fa fa-app" aria-label="Explorer">
      <GreenHead title="Explorer" sub="Des idées pour tous les goûts" back={false} />
      <div className="v3-body ex-body">
        <form className="hm-search" role="search" onSubmit={submit}>
          <label><Icon name="search" /><input type="search" enterKeyHint="search" autoComplete="off" placeholder="Rechercher une recette ou un ingrédient…"
            aria-label="Rechercher une recette" value={q} onChange={e => setQ(e.target.value)} autoFocus={params.has("q")} /></label>
          <button type="button" className="hm-filter" aria-label="Filtres"><Icon name="sliders" /></button>
        </form>
        {query ? <>
          <div className="sp-hd"><h2 className="sp-sec">{found.length ? plural(found.length, "recette") : "Aucune recette"}</h2></div>
          {found.length > 0
            ? <div className="ex-grid">{found.map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
            : <p className="sp-hint">Rien pour « {q.trim()} » pour l'instant. Bientôt, Frigia te proposera cette recette et ses variantes.</p>}
        </> : <>
          <div className="sp-hd"><h2 className="sp-sec">Recettes de la semaine</h2></div>
          <div className="ex-row">{week.map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
          {quick.length > 0 && <>
            <div className="sp-hd"><h2 className="sp-sec">Prêtes en 20 minutes</h2></div>
            <div className="ex-row">{quick.map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
          </>}
        </>}
      </div>
      <AppTabBar active="explore" isPlus={isPlus} />
    </div>
  );
}
