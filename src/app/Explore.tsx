// Explorer (V3, maquette de Hugo du 25 octobre) : chercher une recette, frigo plein ou vide.
// Une recette demandée par son nom (« tartiflette ») revient en 3 : la classique et 2 variantes (plus légère, sans crème…),
// par l'IA (api/dish.ts). Un ingrédient, une catégorie ou un type de plat : 3 plats différents.
// La recherche est dans l'adresse (?q=) : le retour du téléphone revient à Explorer, et les réponses sont gardées 24 h.
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Chip, Icon, Pill } from "../ui/components";
import type { GeneratedRecipe, HistoryEntry } from "../lib/types";
import type { Fridge } from "../lib/home";
import { apiEaters, type Person, portionsOf } from "../lib/household";
import { searchDish } from "../lib/scan";
import { AppTabBar } from "./AppTabBar";
import { GreenHead } from "./GreenHead";
import { weekRecipes } from "./featured";
import { useRecipePhoto } from "./photo";
import { useOpenPaywall } from "./plus/subscription";
import { minutesOf } from "./scan/portions";
import { plural } from "./format";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").trim();
const words = (r: GeneratedRecipe) => [r.title, ...(r.items?.map(i => i.name) ?? r.recipeIngredients?.map(i => i.name) ?? [])].join(" ");

// Les catégories en haut : une recherche toute faite. Photos de l'appli.
const CATS: { label: string; q: string; img: string }[] = [
  { label: "Toutes", q: "", img: "/landing/pasta-legumes.jpg" },
  { label: "Rapides", q: "recettes rapides", img: "/featured/one-pot-pasta.jpg" },
  { label: "Healthy", q: "recettes healthy", img: "/landing/salade-caprese.jpg" },
  { label: "Petit budget", q: "recettes petit budget", img: "/landing/soupe-detox.jpg" },
  { label: "Famille", q: "plats en famille qui plaisent aux enfants", img: "/featured/pizza-tortilla.jpg" },
  { label: "Desserts", q: "desserts", img: "/featured/brownie-banane.jpg" },
];
const TYPES = [
  { label: "Entrées", q: "entrées", img: "/landing/salade-caprese.jpg" },
  { label: "Plats", q: "plats", img: "/landing/gratin-courgettes.jpg" },
  { label: "Desserts", q: "desserts", img: "/featured/brownie-banane.jpg" },
];
// Recettes tendances : des plats qu'on cherche souvent. Toucher lance la recherche (la classique et ses variantes).
const TRENDS = [
  { label: "Gratin de courgettes", img: "/landing/gratin-courgettes.jpg", time: "40 min" },
  { label: "Wrap au poulet", img: "/landing/wrap-proteine.jpg", time: "15 min" },
  { label: "Soupe de légumes", img: "/landing/soupe-detox.jpg", time: "30 min" },
  { label: "Pommes de terre smashées", img: "/featured/pommes-de-terre-smashees.jpg", time: "35 min" },
  { label: "Salade caprese", img: "/landing/salade-caprese.jpg", time: "10 min" },
];

// Les réponses de l'IA, gardées 24 h sur le téléphone : revenir en arrière ne relance pas la recherche
const CACHE = "frigia.explorer";
const DAY = 24 * 3600 * 1000;
type Cached = Record<string, { at: number; recipes: GeneratedRecipe[] }>;
function readCache(): Cached {
  try { return JSON.parse(localStorage.getItem(CACHE) ?? "{}") as Cached; } catch { return {}; }
}
function cached(q: string): GeneratedRecipe[] | null {
  const e = readCache()[norm(q)];
  return e && Date.now() - e.at < DAY ? e.recipes : null;
}
function remember(q: string, recipes: GeneratedRecipe[]) {
  const all = readCache();
  all[norm(q)] = { at: Date.now(), recipes };
  // Les 15 dernières recherches
  const kept = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 15);
  try { localStorage.setItem(CACHE, JSON.stringify(Object.fromEntries(kept))); } catch { /* plein ou navigation privée */ }
}

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

/** Une réponse de la recherche : la photo en grand, la variante, ce qui change */
function Result({ recipe, fav, onOpen }: { recipe: GeneratedRecipe; fav: boolean; onOpen: () => void }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  const toBuy = recipe.items?.filter(i => !i.have).length ?? 0;
  return (
    <button type="button" className="ex-res" onClick={onOpen}>
      <span className="ex-res-img">{photo ? <img src={photo} alt="" /> : null}
        {recipe.variant && <span className="ex-var">{recipe.variant}</span>}
        {fav && <span className="sp-heart" aria-label="Favori"><Icon name="heart-f" /></span>}
      </span>
      <span className="ex-res-tx">
        <b>{recipe.title}</b>
        {recipe.change ? <span className="ex-chg">{recipe.change}</span> : recipe.intro ? <span className="ex-chg">{recipe.intro}</span> : null}
        <span className="ex-meta">{recipe.time} · {recipe.diff}{recipe.veg ? " · Végé" : ""}{recipe.items ? (toBuy ? ` · ${plural(toBuy, "ingrédient")} à acheter` : " · Tu as tout") : ""}</span>
      </span>
    </button>
  );
}

type Search = { key: string; state: "loading" | "ok" | "error"; recipes: GeneratedRecipe[]; message?: string };

export function Explore({ isPlus, history, favorites, kitchen, household, onOpenRecipe }: {
  isPlus: boolean; history: HistoryEntry[]; favorites: GeneratedRecipe[]; kitchen: Fridge;
  /** Le foyer : les allergies (obligatoires) et les portions des recettes trouvées */
  household: Person[];
  onOpenRecipe: (r: GeneratedRecipe) => void;
}) {
  const openPaywall = useOpenPaywall();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = params.get("c") ?? "";
  const [text, setText] = useState(params.has("c") ? "" : q);
  const [filters, setFilters] = useState(params.has("filtres"));
  const [quick, setQuick] = useState(false);
  const [veg, setVeg] = useState(false);
  const [easy, setEasy] = useState(false);
  const [chip, setChip] = useState<string | null>(null);
  const [fetched, setFetched] = useState<Search | null>(null);
  // « Réessayer » relance la même recherche
  const [tries, setTries] = useState(0);

  const week = useMemo(() => weekRecipes(kitchen.items).map(x => x.recipe), [kitchen.items]);
  // Toutes les recettes connues, sans doublon : la semaine, les favoris, puis les scans
  const known = useMemo(() => {
    const seen = new Set<string>();
    return [...week, ...favorites, ...history.flatMap(e => e.recipes)].filter(r => !seen.has(r.title) && !!seen.add(r.title));
  }, [week, favorites, history]);
  const isFav = (r: GeneratedRecipe) => favorites.some(f => f.title === r.title);
  const pass = (r: GeneratedRecipe) => (!quick || (minutesOf(r) > 0 && minutesOf(r) <= 30)) && (!veg || !!r.veg) && (!easy || r.diff === "Facile");
  // « Des idées selon tes ingrédients » : ce qu'il y a dans Ma cuisine (le plus récent d'abord)
  const mine = useMemo(() => [...new Set(kitchen.items.map(i => i.name))].slice(0, 8), [kitchen.items]);
  const picked = chip ?? mine[0] ?? null;
  // « Œufs » trouve « œuf » : sans le s final
  const withChip = picked ? known.filter(r => norm(words(r)).includes(norm(picked).replace(/s$/, ""))) : [];

  // La recherche de l'adresse : gardée 24 h, sinon demandée à l'IA (une fois par adresse, ou par « Réessayer »)
  const key = `${q}#${tries}`;
  const hit = useMemo(() => (q ? cached(q) : null), [q]);
  useEffect(() => {
    if (!q || hit) return;
    let live = true;
    const people = household;
    void searchDish({
      query: q, kitchen: kitchen.items.map(i => i.name),
      servings: people.length ? Math.max(1, Math.round(portionsOf(people, 0))) : 2,
      eaters: people.length ? apiEaters(people) : undefined,
    }).then(r => {
      if (!live) return;
      if (r.status === "ok") { remember(q, r.recipes); setFetched({ key, state: "ok", recipes: r.recipes }); }
      else if (r.status === "quota") openPaywall("def", "/explorer");
      else setFetched({ key, state: "error", recipes: [], message: r.status === "error" ? (r.message ?? (r.rate ? "Beaucoup de recherches cette heure-ci. Réessaie un peu plus tard." : "La recherche n'a pas marché. Vérifie ta connexion et réessaie.")) : undefined });
    });
    return () => { live = false; };
    // Une recherche par adresse : le reste (cuisine, foyer) est lu au moment de chercher
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hit]);
  const search: Search | null = !q ? null : hit ? { key, state: "ok", recipes: hit } : fetched?.key === key ? fetched : { key, state: "loading", recipes: [] };

  const go = (query: string, c?: string) => {
    const next = query.trim();
    setText(c ? "" : next);
    if (!next) { setParams({}, { replace: true }); return; }
    setParams(c ? { q: next, c } : { q: next });
  };
  const submit = (e: FormEvent) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); go(text); };
  const local = q ? known.filter(r => norm(words(r)).includes(norm(q).replace(/s$/, ""))) : [];

  return (
    <div className="fa fa-app" aria-label="Explorer">
      <GreenHead title="Explorer" sub="Des idées pour tous les goûts" back={false} />
      <div className="v3-body ex-body">
        <form className="hm-search" role="search" onSubmit={submit}>
          <label><Icon name="search" /><input type="search" enterKeyHint="search" autoComplete="off" placeholder="Rechercher une recette ou un ingrédient…"
            aria-label="Rechercher une recette" value={text} onChange={e => setText(e.target.value)} /></label>
          <button type="button" className={"hm-filter" + (filters || quick || veg || easy ? " on" : "")} aria-label="Filtres" aria-expanded={filters} onClick={() => setFilters(f => !f)}><Icon name="sliders" /></button>
        </form>
        {filters && (
          <div className="chips ex-filters">
            <Chip on={quick} onClick={() => setQuick(v => !v)}>Moins de 30 min</Chip>
            <Chip on={veg} onClick={() => setVeg(v => !v)}>Végé</Chip>
            <Chip on={easy} onClick={() => setEasy(v => !v)}>Facile</Chip>
          </div>
        )}

        <div className="ex-cats" role="list">
          {CATS.map(c => {
            const on = c.q ? cat === c.label : !q;
            return (
              <button key={c.label} type="button" role="listitem" className={"ex-cat" + (on ? " on" : "")} aria-pressed={on}
                onClick={() => (c.q ? go(c.q, c.label) : go(""))}>
                <img src={c.img} alt="" /><span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {q ? <>
          <div className="sp-hd"><h2 className="sp-sec">{cat || `« ${q} »`}</h2><button type="button" className="sp-all" onClick={() => { setText(""); go(""); }}>Effacer</button></div>
          {search?.state === "loading" && (
            <div className="ex-wait" role="status">
              <span className="ex-dots" aria-hidden="true"><i /><i /><i /></span>
              <b>Frigia prépare tes recettes…</b>
              <span>{cat ? "Trois idées, rien que pour toi." : "La classique, et des variantes si le plat s'y prête."}</span>
            </div>
          )}
          {search?.state === "error" && (
            <div className="ex-wait">
              <b>Pas de recette pour l'instant</b>
              <span>{search.message}</span>
              <Pill tone="cream" onClick={() => setTries(n => n + 1)}>Réessayer</Pill>
            </div>
          )}
          {search?.state === "ok" && (
            !search.recipes.length ? <p className="sp-hint">Pas de recette trouvée. Essaie un autre nom.</p>
            : search.recipes.filter(pass).length
              ? <div className="ex-results">{search.recipes.filter(pass).map(r => <Result key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
              : <p className="sp-hint">Aucune recette ne passe les filtres. Enlève un filtre pour tout voir.</p>
          )}
          {local.filter(pass).length > 0 && <>
            <div className="sp-hd"><h2 className="sp-sec">Dans tes recettes</h2></div>
            <div className="ex-row">{local.filter(pass).map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
          </>}
        </> : <>
          <div className="sp-hd"><h2 className="sp-sec">Recettes de la semaine</h2></div>
          <div className="ex-row">{week.filter(pass).map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>

          {mine.length > 0 && <>
            <div className="sp-hd"><h2 className="sp-sec">Des idées selon tes ingrédients</h2></div>
            <div className="chips ex-chips">
              {mine.map(n => <Chip key={n} on={n === picked} onClick={() => setChip(n)}>{n}</Chip>)}
            </div>
            {withChip.filter(pass).length > 0
              ? <div className="ex-row">{withChip.filter(pass).map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
              : picked && (
                <button type="button" className="sp-card sp-line" onClick={() => go(picked)}>
                  <span className="sp-ic"><Icon name="sparkle" /></span>
                  <span className="tx"><b>Des recettes avec {picked.toLowerCase()}</b><span>Frigia t'en propose trois</span></span>
                  <Icon name="next" />
                </button>
              )}
          </>}

          <div className="sp-hd"><h2 className="sp-sec">Par type de plat</h2></div>
          <div className="ex-types">
            {TYPES.map(t => (
              <button key={t.label} type="button" className="ex-type" onClick={() => go(t.q, t.label)}>
                <img src={t.img} alt="" /><span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="sp-hd"><h2 className="sp-sec">Recettes tendances</h2></div>
          <div className="ex-row">
            {TRENDS.map(t => (
              <button key={t.label} type="button" className="ex-card" onClick={() => go(t.label)}>
                <span className="ex-img"><img src={t.img} alt="" loading="lazy" /></span>
                <b>{t.label}</b>
                <span>{t.time} · et ses variantes</span>
              </button>
            ))}
          </div>
        </>}
      </div>
      <AppTabBar active="explore" isPlus={isPlus} />
    </div>
  );
}
