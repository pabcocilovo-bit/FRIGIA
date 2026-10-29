// Mon espace Frigia (V3, maquette de Hugo du 25 octobre) : tout le suivi au même endroit.
// Tes économies, tes courses, tes derniers scans, tes favoris et tes statistiques. L'accueil y mène par « Mon espace Frigia ».
import { useNavigate } from "react-router";
import { Icon, LockPill } from "../ui/components";
import type { GeneratedRecipe, HistoryEntry } from "../lib/types";
import { type CookedMeal, isMeal, thisMonth, totalSaved } from "../lib/cooked";
import type { ShopItem } from "../lib/home";
import { euros, kilos } from "./scan/savings";
import { AppTabBar } from "./AppTabBar";
import { GreenHead } from "./GreenHead";
import { daysAgo, plural, scanWhen } from "./format";
import { useOpenScan } from "./offline";
import { useRecipePhoto } from "./photo";
import { useOpenPaywall } from "./plus/subscription";
import { timeText } from "../lib/recipes";

function ScanRow({ entry, locked, onClick }: { entry: HistoryEntry; locked: boolean; onClick: () => void }) {
  const first = entry.recipes[0];
  const photo = useRecipePhoto(first?.title, first?.imageSearch);
  return (
    <button type="button" className={"sp-row" + (locked ? " blur" : "")} onClick={onClick}>
      {photo ? <img src={photo} alt="" /> : <span className="sp-ph" />}
      <span className="tx"><b>{scanWhen(entry.date)}</b><span>{entry.ingredients.length ? plural(entry.ingredients.length, "ingrédient") : "Frigo vide"} · {plural(entry.recipes.length, "recette")}</span></span>
      {locked ? <LockPill /> : <Icon name="next" />}
    </button>
  );
}

function FavCard({ recipe, fav, onClick }: { recipe: GeneratedRecipe; fav: boolean; onClick: () => void }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  return (
    <button type="button" className="sp-fav" onClick={onClick}>
      {photo ? <img src={photo} alt="" /> : <span className="sp-ph" />}
      {fav && <span className="sp-heart" aria-label="Favori"><Icon name="heart-f" /></span>}
      <b>{recipe.title}</b>
      <span>{timeText(recipe.time)}</span>
    </button>
  );
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function Space({ isPlus, history, favorites, cooked, shopping, onOpenRecipe }: {
  isPlus: boolean; history: HistoryEntry[]; favorites: GeneratedRecipe[];
  cooked: CookedMeal[]; shopping: ShopItem[];
  onOpenRecipe: (r: GeneratedRecipe) => void;
}) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const month = thisMonth(cooked);
  const mName = MONTHS[new Date().getMonth()];
  // Ce que les repas cuisinés ce mois-ci ont sauvé (le détail : Ton bilan)
  const saved = totalSaved(month);
  const mealsN = month.filter(isMeal).length;
  const toBuy = shopping.filter(x => !x.done);
  // Sans favori : les recettes du dernier scan encore ouvert (moins de 7 jours en gratuit)
  const recent = history.find(e => e.recipes.length > 0 && (isPlus || daysAgo(e.date) <= 7));
  const favs = favorites.length > 0 ? favorites.slice(0, 3) : recent ? recent.recipes.slice(0, 3) : [];
  const bilan = () => (isPlus ? navigate("/bilan") : openPaywall("bilan"));

  return (
    <div className="fa fa-app" aria-label="Mon espace Frigia">
      <GreenHead title="Mon espace Frigia" sub="Tout ton suivi au même endroit" />
      <div className="v3-body sp-body">
        {saved.kg > 0 || saved.usedKg > 0 ? (
          <button type="button" className="sp-hi" onClick={bilan}>
            <span className="sp-hi-ic"><Icon name="leaf" /></span>
            {/* Sauvé : ce qui était « À finir ». Sans rien de marqué, ce qui a été cuisiné de ton frigo. */}
            {saved.kg > 0
              ? <span className="tx"><b>{euros(saved.eur)} économisés en {mName}</b><span>{kilos(saved.kg)} de nourriture en moins à la poubelle</span></span>
              : <span className="tx"><b>{kilos(saved.usedKg)} de ton frigo cuisinés en {mName}</b><span>Marque « À finir » au scan pour compter ce que tu sauves</span></span>}
            {isPlus ? <Icon name="next" /> : <span className="lockpill">Aperçu</span>}
          </button>
        ) : (
          <button type="button" className="sp-hi" onClick={openScan}>
            <span className="sp-hi-ic"><Icon name="leaf" /></span>
            <span className="tx"><b>Tes économies arriveront ici</b><span>Cuisine avec ton frigo : Frigia compte ce que tu ne jettes pas</span></span>
            <Icon name="next" />
          </button>
        )}

        {/* La liste de courses : cochée au magasin, elle range tout dans Ma cuisine */}
        <h2 className="sp-sec">Tes courses</h2>
        <button type="button" className="sp-card sp-line" onClick={() => navigate("/courses")}>
          <span className="sp-ic"><Icon name="cart" /></span>
          <span className="tx">{toBuy.length
            ? <><b>{plural(toBuy.length, "article")} à acheter</b><span>{toBuy.slice(0, 3).map(x => x.name).join(", ")}{toBuy.length > 3 ? "…" : ""}</span></>
            : <><b>Ta liste de courses</b><span>Ce qui manque à une recette s'ajoute en un appui</span></>}</span>
          <Icon name="next" />
        </button>

        <div className="sp-hd"><h2 className="sp-sec">Tes derniers scans</h2>{history.length > 0 && <button type="button" className="sp-all" onClick={() => navigate("/scans")}>Voir tout<Icon name="next" /></button>}</div>
        {history.length > 0 ? (
          <div className="sp-card sp-list">
            {history.slice(0, 2).map(e => (
              <ScanRow key={e.id} entry={e} locked={!isPlus && daysAgo(e.date) > 7} onClick={() => (!isPlus && daysAgo(e.date) > 7 ? openPaywall("historique") : navigate(`/recettes/${e.id}`))} />
            ))}
          </div>
        ) : (
          <button type="button" className="sp-card sp-line" onClick={openScan}>
            <span className="sp-ic"><Icon name="cam" /></span>
            <span className="tx"><b>Pas encore de scan</b><span>Prends ton frigo en photo : trois recettes avec ce que tu as</span></span>
            <Icon name="next" />
          </button>
        )}

        <div className="sp-hd"><h2 className="sp-sec">Tes favoris</h2>{favorites.length > 0 && <button type="button" className="sp-all" onClick={() => navigate("/favoris")}>Voir tout<Icon name="next" /></button>}</div>
        {favs.length > 0 ? <>
          {favorites.length === 0 && <p className="sp-hint">Touche <Icon name="heart" /> sur une recette pour la garder ici. Celles de ton dernier scan :</p>}
          <div className="sp-favs">
            {favs.map(r => <FavCard key={r.title} recipe={r} fav={favorites.length > 0} onClick={() => onOpenRecipe(r)} />)}
          </div>
        </> : (
          <div className="sp-card sp-line">
            <span className="sp-ic"><Icon name="heart" /></span>
            <span className="tx"><b>Tes recettes préférées arriveront ici</b><span>Touche le cœur sur une recette pour la garder</span></span>
          </div>
        )}

        <h2 className="sp-sec">Statistiques</h2>
        <button type="button" className="sp-card sp-line" onClick={bilan}>
          <span className="sp-ic"><Icon name="chart" /></span>
          <span className="tx"><b>{mealsN ? `${plural(mealsN, "repas cuisiné")} ce mois-ci` : "Aucun repas cuisiné ce mois-ci"}</b>
            <span>{saved.usedKg > 0 ? `Soit ${kilos(saved.usedKg)} de ton frigo cuisinés` : "Touche « J'ai cuisiné ça » à la fin d'une recette"}</span></span>
          {isPlus ? <Icon name="next" /> : <LockPill />}
        </button>
        {saved.kg > 0 && (
          <div className="sp-hi sp-bravo">
            <span className="sp-hi-ic"><Icon name="leaf" /></span>
            <span className="tx"><b>Bravo&nbsp;!</b><span>Tu as évité {kilos(saved.kg)} de nourriture à la poubelle ce mois-ci.</span></span>
          </div>
        )}
      </div>
      <AppTabBar active="home" isPlus={isPlus} />
    </div>
  );
}
