// Explorer (V3, maquette de Hugo du 25 octobre) : chercher une recette, frigo plein ou vide.
// L'accueil, à la Netflix (Hugo, 26 octobre) : la recette du jour, le Top 10 et des rangées qui défilent au doigt,
// tirées du catalogue (api/_browse.ts, jamais l'IA), gardées pour la journée. « Tout voir » ouvre la rangée en grille (?rang=).
// Une recette demandée par son nom (« tartiflette ») revient en 3 : la classique et 2 variantes (plus légère, sans crème…),
// par l'IA (api/_dish.ts) ou le catalogue des recherches déjà faites. Un ingrédient, une catégorie ou un type de plat : 6 plats différents
// tirés au sort dans le catalogue (« Autres idées » en tire 6 autres), ou 3 de l'IA pour une recherche nouvelle.
// Les recettes arrivent pour 4 portions, sans rien savoir de Ma cuisine : ce qu'on a déjà est coché ici.
// La recherche est dans l'adresse (?q=) : le retour du téléphone revient à Explorer, et les réponses sont gardées 24 h.
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Chip, Icon, Pill } from "../ui/components";
import type { GeneratedRecipe, HistoryEntry } from "../lib/types";
import type { Fridge } from "../lib/home";
import { apiEaters, type Person } from "../lib/household";
import { type Browse, type BrowseDish, type BrowseRow, browseExplore, searchDish } from "../lib/scan";
import { AppTabBar } from "./AppTabBar";
import { GreenHead } from "./GreenHead";
import { weekRecipes } from "./featured";
import { useRecipePhoto } from "./photo";
import { useOpenPaywall } from "./plus/subscription";
import { inFridge, minutesOf } from "./scan/portions";
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
const TRENDS: { label: string; img: string; time: string; q?: string }[] = [
  { label: "Gratin de courgettes", img: "/landing/gratin-courgettes.jpg", time: "40 min" },
  { label: "Wrap au poulet", img: "/landing/wrap-proteine.jpg", time: "15 min" },
  { label: "Soupe de légumes", img: "/landing/soupe-detox.jpg", time: "30 min" },
  { label: "Pommes de terre smashées", q: "smashed potatoes", img: "/featured/pommes-de-terre-smashees.jpg", time: "35 min" },
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

// Les rangées du jour, gardées sur le téléphone : revenir sur Explorer ne recharge rien
const ROWS = "frigia.explorer.rows.v2";
const localDay = () => new Date().toLocaleDateString("fr-FR");
function readRows(sig: string): Browse | null {
  try {
    const e = JSON.parse(localStorage.getItem(ROWS) ?? "null") as { day: string; sig: string; data: Browse } | null;
    return e && e.day === localDay() && e.sig === sig ? e.data : null;
  } catch { return null; }
}
function keepRows(sig: string, data: Browse) {
  try { localStorage.setItem(ROWS, JSON.stringify({ day: localDay(), sig, data })); } catch { /* plein ou navigation privée */ }
}

/** La photo seulement quand la carte arrive à l'écran : une rangée de 12 ne cherche pas 12 photos d'un coup */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setSeen(true); }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

/** Une affiche : la photo en hauteur, le nom dessus */
function Poster({ title, sub, image, fav, onOpen }: { title: string; sub: string; image: string; fav?: boolean; onOpen: () => void }) {
  const [ref, seen] = useSeen<HTMLButtonElement>();
  const photo = useRecipePhoto(seen ? title : undefined, seen ? image : undefined);
  return (
    <button ref={ref} type="button" className="ex-poster" onClick={onOpen}>
      {photo ? <img src={photo} alt="" loading="lazy" /> : null}
      {fav && <span className="sp-heart" aria-label="Favori"><Icon name="heart-f" /></span>}
      <span className="ex-pt"><b>{title}</b><small>{sub}</small></span>
    </button>
  );
}
const dishSub = (d: BrowseDish) => `${d.minutes ? `${d.minutes} min` : ""}${d.minutes && d.difficulty ? " · " : ""}${d.difficulty}`;
const recipeSub = (r: GeneratedRecipe) => `${r.time}${r.diff ? ` · ${r.diff}` : ""}`;

/** La recette du jour, en grand */
function Hero({ dish, onOpen }: { dish: BrowseDish; onOpen: () => void }) {
  const photo = useRecipePhoto(dish.title, dish.imageUrl ?? dish.imageSearch);
  return (
    <button type="button" className="ex-hero" onClick={onOpen}>
      {photo ? <img src={photo} alt="" /> : null}
      <span className="ex-hero-tx">
        <small>La recette du jour</small>
        <b>{dish.title}</b>
        <span>{dishSub(dish)} · et ses variantes</span>
        <span className="ex-hero-go">Voir la recette <Icon name="next" /></span>
      </span>
    </button>
  );
}

const cxRow = (row: BrowseRow) => "ex-row ex-posters" + (row.top ? " ex-tops" : "");

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
  // « Réessayer » et « Autres idées » relancent la même recherche, sans la réponse gardée ; skip : les titres déjà montrés
  const [redo, setRedo] = useState({ q: "", n: 0 });
  const tries = redo.q === q ? redo.n : 0;
  const skip = useRef<string[]>([]);
  // Les recettes du catalogue pour l'ingrédient choisi (jamais l'IA) ; undefined tant qu'elles arrivent
  const [byChip, setByChip] = useState<Record<string, GeneratedRecipe[]>>({});

  const rang = params.get("rang");
  // « Tout voir » : la grille s'ouvre en haut de la page
  const top = useRef<HTMLFormElement>(null);
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
  const fromCatalog = picked ? byChip[picked] : undefined;
  // Tes recettes d'abord, puis ta dernière recherche de ce mot (« pêches »), puis le catalogue, avec ce que tu as déjà coché
  const withChip = useMemo(() => {
    if (!picked) return [];
    const seen = new Set<string>();
    return [...known.filter(r => norm(words(r)).includes(norm(picked).replace(/s$/, ""))), ...(cached(picked) ?? []), ...(fromCatalog ?? [])]
      .filter(r => !seen.has(r.title) && !!seen.add(r.title))
      .map(r => (r.items ? { ...r, items: r.items.map(i => ({ ...i, have: inFridge(i.name, kitchen.items) })) } : r));
    // q : revenir d'une recherche relit les réponses gardées
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, known, fromCatalog, kitchen.items, q]);
  useEffect(() => {
    // Rien trouvé : on redemande au retour d'une recherche (elle a pu ajouter ce mot au catalogue)
    if (q || !picked || !isPlus || byChip[picked]?.length) return;
    const keep = (recipes: GeneratedRecipe[]) => setByChip(m => ({ ...m, [picked]: recipes }));
    const saved = cached(`+${picked}`);
    if (saved) { keep(saved); return; }
    let live = true;
    void searchDish({ query: picked, catalogOnly: true, eaters: household.length ? apiEaters(household) : undefined }).then(r => {
      if (!live) return;
      const recipes = r.status === "ok" ? r.recipes : [];
      if (recipes.length) remember(`+${picked}`, recipes);
      keep(recipes);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, picked, isPlus]);

  // Les rangées du jour (Plus) : selon Ma cuisine et les allergies du foyer
  const allergies = household.length ? apiEaters(household) : undefined;
  const sig = JSON.stringify([mine, allergies?.map(e => e.allergies)]);
  const saved = useMemo(() => readRows(sig), [sig]);
  const [rows, setRows] = useState<{ sig: string; data: Browse | null } | null>(null);
  // undefined : en chargement ; null : pas de rangées (pas Plus, ou le serveur n'a pas répondu)
  const browse = saved ?? (rows?.sig === sig ? rows.data : isPlus ? undefined : null);
  useEffect(() => {
    if (!isPlus || saved) return;
    let live = true;
    void browseExplore({ ingredients: mine, eaters: allergies }).then(data => {
      if (!live) return;
      if (data) keepRows(sig, data);
      setRows({ sig, data });
    });
    return () => { live = false; };
    // Une fois par jour, ou quand Ma cuisine change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, isPlus]);
  const passDish = (d: BrowseDish) => (!quick || (d.minutes > 0 && d.minutes <= 30)) && (!veg || d.veg) && (!easy || d.difficulty === "Facile");
  const withHave = (r: GeneratedRecipe) => (r.items ? { ...r, items: r.items.map(i => ({ ...i, have: inFridge(i.name, kitchen.items) })) } : r);
  // Les rangées de l'appli glissées entre celles du catalogue : la semaine, tes favoris, tes dernières recettes
  const allRows = useMemo<BrowseRow[]>(() => {
    if (!browse) return [];
    const list = [...browse.rows];
    const at = (i: number, row: BrowseRow) => { if (row.recipes?.length) list.splice(Math.min(i, list.length), 0, row); };
    const mineCount = list.filter(r => r.id.startsWith("ing-")).length;
    at(1 + mineCount, { id: "semaine", title: "Recettes de la semaine", recipes: week });
    at(5 + mineCount, { id: "favoris", title: "Tes favoris", recipes: favorites.slice(0, 12) });
    const seen = new Set<string>();
    at(9 + mineCount, { id: "historique", title: "Tes dernières recettes",
      recipes: history.flatMap(e => e.recipes).filter(r => !seen.has(r.title) && !!seen.add(r.title)).slice(0, 12) });
    return list;
  }, [browse, week, favorites, history]);
  const shown = (row: BrowseRow) => row.dishes ? row.dishes.filter(passDish) : (row.recipes ?? []).filter(pass);
  const tile = (x: BrowseDish | GeneratedRecipe) => ("q" in x
    ? <Poster key={x.q} title={x.title} sub={dishSub(x)} image={x.imageUrl ?? x.imageSearch} onOpen={() => go(x.q)} />
    : <Poster key={x.title} title={x.title} sub={recipeSub(x)} image={x.imageSearch ?? x.title} fav={isFav(x)} onOpen={() => onOpenRecipe(withHave(x))} />);
  const openRow = rang ? allRows.find(r => r.id === rang) : undefined;

  // La recherche de l'adresse : gardée 24 h, sinon demandée à l'IA (une fois par adresse, ou par « Réessayer »)
  const key = `${q}#${tries}`;
  const hit = useMemo(() => (q && !tries ? cached(q) : null), [q, tries]);
  useEffect(() => {
    if (!q || hit) return;
    let live = true;
    void searchDish({ query: q, eaters: household.length ? apiEaters(household) : undefined, skip: skip.current }).then(r => {
      if (!live) return;
      if (r.status === "ok") { remember(q, r.recipes); setFetched({ key, state: "ok", recipes: r.recipes }); }
      else if (r.status === "quota") openPaywall("def", "/explorer");
      else setFetched({ key, state: "error", recipes: [], message: r.status === "error" ? (r.message ?? (r.rate ? "Beaucoup de recherches cette heure-ci. Réessaie un peu plus tard." : "La recherche n'a pas marché. Vérifie ta connexion et réessaie.")) : undefined });
    });
    return () => { live = false; };
    // Une recherche par adresse : le foyer est lu au moment de chercher
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hit]);
  const search: Search | null = !q ? null : hit ? { key, state: "ok", recipes: hit } : fetched?.key === key ? fetched : { key, state: "loading", recipes: [] };
  // Ce qu'il y a dans Ma cuisine, coché sur les recettes trouvées
  const found = (search?.state === "ok" ? search.recipes : [])
    .map(r => (r.items ? { ...r, items: r.items.map(i => ({ ...i, have: inFridge(i.name, kitchen.items) })) } : r));

  const again = (titles: string[]) => { skip.current = titles; setRedo({ q, n: tries + 1 }); };
  const go = (query: string, c?: string) => {
    const next = query.trim();
    setText(c ? "" : next);
    skip.current = [];
    if (!next) { setParams({}, { replace: true }); return; }
    setParams(c ? { q: next, c } : { q: next });
  };
  const submit = (e: FormEvent) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); go(text); };
  const local = q ? known.filter(r => norm(words(r)).includes(norm(q).replace(/s$/, ""))) : [];

  return (
    <div className="fa fa-app" aria-label="Explorer">
      <GreenHead title="Explorer" sub="Des idées pour tous les goûts" back={false} />
      <div className="v3-body ex-body">
        <form ref={top} className="hm-search" role="search" onSubmit={submit}>
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
              <span>{cat ? "Des idées rien que pour toi." : "La classique, et des variantes si le plat s'y prête."}</span>
            </div>
          )}
          {search?.state === "error" && (
            <div className="ex-wait">
              <b>Pas de recette pour l'instant</b>
              <span>{search.message}</span>
              <Pill tone="cream" onClick={() => again([])}>Réessayer</Pill>
            </div>
          )}
          {search?.state === "ok" && (
            !found.length ? <p className="sp-hint">Pas de recette trouvée. Essaie un autre nom.</p>
            : found.filter(pass).length
              ? <div className="ex-results">{found.filter(pass).map(r => <Result key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
              : <p className="sp-hint">Aucune recette ne passe les filtres. Enlève un filtre pour tout voir.</p>
          )}
          {/* Une réserve du catalogue (6 recettes, pas de variante) : on peut en tirer d'autres */}
          {search?.state === "ok" && found.length >= 6 && found.every(r => !r.variant) && (
            <div className="ex-more"><Pill tone="line" icon="sparkle" onClick={() => again(found.map(r => r.title))}>Autres idées</Pill></div>
          )}
          {local.filter(pass).length > 0 && <>
            <div className="sp-hd"><h2 className="sp-sec">Dans tes recettes</h2></div>
            <div className="ex-row">{local.filter(pass).map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
          </>}
        </> : openRow ? <>
          <div className="sp-hd"><h2 className="sp-sec">{openRow.title}</h2><button type="button" className="sp-all" onClick={() => setParams({}, { replace: true })}>Fermer</button></div>
          {shown(openRow).length
            ? <div className="ex-grid">{shown(openRow).map(x => tile(x))}</div>
            : <p className="sp-hint">Aucune recette ne passe les filtres. Enlève un filtre pour tout voir.</p>}
          {openRow.q && <div className="ex-more"><Pill tone="line" icon="sparkle" onClick={() => go(openRow.q!, openRow.title)}>Autres idées</Pill></div>}
        </> : browse ? <>
          {browse.hero && <Hero dish={browse.hero} onOpen={() => go(browse.hero!.q)} />}
          {allRows.map(row => {
            const items = shown(row);
            if (!items.length) return null;
            return (
              <section key={row.id} className="ex-sec" aria-label={row.title}>
                <div className="sp-hd"><h2 className="sp-sec">{row.title}</h2>
                  {!row.top && items.length > 3 && <button type="button" className="sp-all" onClick={() => { setParams({ rang: row.id }); top.current?.scrollIntoView({ block: "start" }); }}>Tout voir</button>}</div>
                <div className={cxRow(row)}>
                  {row.top
                    ? (items as BrowseDish[]).map((d, i) => (
                      <span key={d.q} className="ex-top"><span className="ex-num" aria-hidden="true">{i + 1}</span>{tile(d)}</span>))
                    : items.map(x => tile(x))}
                </div>
              </section>
            );
          })}
        </> : isPlus && browse === undefined ? (
          <div className="ex-skel" role="status" aria-label="Chargement des recettes">
            <span className="ex-skel-hero" />
            {[0, 1].map(i => <span key={i} className="ex-skel-row"><i /><i /><i /></span>)}
          </div>
        ) : <>
          <div className="sp-hd"><h2 className="sp-sec">Recettes de la semaine</h2></div>
          <div className="ex-row">{week.filter(pass).map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>

          {mine.length > 0 && <>
            <div className="sp-hd"><h2 className="sp-sec">Des idées selon tes ingrédients</h2>
              {picked && <button type="button" className="sp-all" onClick={() => go(picked)}>Plus d'idées</button>}</div>
            <div className="chips ex-chips">
              {mine.map(n => <Chip key={n} on={n === picked} onClick={() => setChip(n)}>{n}</Chip>)}
            </div>
            {withChip.filter(pass).length > 0
              ? <div className="ex-row">{withChip.filter(pass).map(r => <Card key={r.title} recipe={r} fav={isFav(r)} onOpen={() => onOpenRecipe(r)} />)}</div>
              : picked && (fromCatalog || !isPlus) && (
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
              <button key={t.label} type="button" className="ex-card" onClick={() => go(t.q ?? t.label)}>
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
