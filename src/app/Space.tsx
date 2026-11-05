// Mon espace Frigia (V3, maquette de Hugo du 25 octobre) : tout le suivi au même endroit.
// Tes économies, ton budget courses, tes courses, tes derniers scans, tes favoris et tes statistiques. L'accueil y mène par « Mon espace Frigia ».
// Le budget peut aussi aller sur l'accueil (Hugo, 5 novembre).
import { useNavigate } from "react-router";
import { Icon, LockPill } from "../ui/components";
import type { GeneratedRecipe, HistoryEntry } from "../lib/types";
import { type CookedMeal, isMeal, thisMonth, totalSaved } from "../lib/cooked";
import type { ShopItem } from "../lib/home";
import { euros, kilos } from "./scan/savings";
import { AppTabBar } from "./AppTabBar";
import { GreenHead } from "./GreenHead";
import { daysAgo, MONTHS, plural, scanWhen } from "./format";
import { t } from "../lib/i18n";
import { useOpenScan } from "./offline";
import { useRecipePhoto } from "./photo";
import { useOpenPaywall } from "./plus/subscription";
import { timeText } from "../lib/recipes";
import type { Budget } from "../lib/budget";
import { BudgetCard } from "./family/Budget";
import { showToast } from "./toast";
import "./family/family.css";

function ScanRow({ entry, locked, onClick }: { entry: HistoryEntry; locked: boolean; onClick: () => void }) {
  const first = entry.recipes[0];
  const photo = useRecipePhoto(first?.title, first?.imageSearch);
  return (
    <button type="button" className={"sp-row" + (locked ? " blur" : "")} onClick={onClick}>
      {photo ? <img src={photo} alt="" /> : <span className="sp-ph" />}
      <span className="tx"><b>{scanWhen(entry.date)}</b><span>{entry.ingredients.length ? plural(entry.ingredients.length, "ingrédient", "ingredient") : t("Frigo vide", "Empty fridge")} · {plural(entry.recipes.length, "recette", "recipe")}</span></span>
      {locked ? <LockPill /> : <Icon name="next" />}
    </button>
  );
}

function FavCard({ recipe, fav, onClick }: { recipe: GeneratedRecipe; fav: boolean; onClick: () => void }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  return (
    <button type="button" className="sp-fav" onClick={onClick}>
      {photo ? <img src={photo} alt="" /> : <span className="sp-ph" />}
      {fav && <span className="sp-heart" aria-label={t("Favori", "Favourite")}><Icon name="heart-f" /></span>}
      <b>{recipe.title}</b>
      <span>{timeText(recipe.time)}</span>
    </button>
  );
}

export function Space({ isPlus, history, favorites, cooked, shopping, budget, onBudget, onOpenRecipe }: {
  isPlus: boolean; history: HistoryEntry[]; favorites: GeneratedRecipe[];
  cooked: CookedMeal[]; shopping: ShopItem[];
  budget: Budget; onBudget: (u: (b: Budget) => Budget) => void;
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
  const onHome = !!budget.home;
  const pin = () => {
    onBudget(b => ({ ...b, home: !onHome }));
    showToast(onHome ? t("Budget retiré de l'accueil", "Budget removed from home") : t("Budget ajouté à l'accueil", "Budget added to home"));
  };

  return (
    <div className="fa fa-app" aria-label={t("Mon espace Frigia", "My Frigia space")}>
      <GreenHead title={t("Mon espace Frigia", "My Frigia space")} sub={t("Tout ton suivi au même endroit", "All your progress in one place")} />
      <div className="v3-body sp-body">
        {saved.kg > 0 || saved.usedKg > 0 ? (
          <button type="button" className="sp-hi" onClick={bilan}>
            <span className="sp-hi-ic"><Icon name="leaf" /></span>
            {/* Sauvé : ce qui était « À finir ». Sans rien de marqué, ce qui a été cuisiné de ton frigo. */}
            {saved.kg > 0
              ? <span className="tx"><b>{t(`${euros(saved.eur)} économisés en ${mName}`, `${euros(saved.eur)} saved in ${mName}`)}</b><span>{t(`${kilos(saved.kg)} de nourriture en moins à la poubelle`, `${kilos(saved.kg)} less food in the bin`)}</span></span>
              : <span className="tx"><b>{t(`${kilos(saved.usedKg)} de ton frigo cuisinés en ${mName}`, `${kilos(saved.usedKg)} from your fridge cooked in ${mName}`)}</b><span>{t("Marque « À finir » au scan pour compter ce que tu sauves", "Mark \"Use up\" when you scan to count what you save")}</span></span>}
            {isPlus ? <Icon name="next" /> : <span className="lockpill">{t("Aperçu", "Preview")}</span>}
          </button>
        ) : (
          <button type="button" className="sp-hi" onClick={openScan}>
            <span className="sp-hi-ic"><Icon name="leaf" /></span>
            <span className="tx"><b>{t("Tes économies arriveront ici", "Your savings will show up here")}</b><span>{t("Cuisine avec ton frigo : Frigia compte ce que tu ne jettes pas", "Cook with your fridge: Frigia counts what you don't throw away")}</span></span>
            <Icon name="next" />
          </button>
        )}

        {/* Le budget courses (Plus) : la carte du mois, et le choix de l'avoir aussi sur l'accueil */}
        <div className="sp-hd"><h2 className="sp-sec">{t("Ton budget courses", "Your grocery budget")}</h2>{isPlus && <button type="button" className="sp-all" onClick={pin}>{onHome ? t("Retirer de l'accueil", "Remove from home") : t("Ajouter à l'accueil", "Add to home")}</button>}</div>
        <BudgetCard isPlus={isPlus} budget={budget} meals={cooked} />

        {/* La liste de courses : cochée au magasin, elle range tout dans Ma cuisine */}
        <h2 className="sp-sec">{t("Tes courses", "Your shopping")}</h2>
        <button type="button" className="sp-card sp-line" onClick={() => navigate("/courses")}>
          <span className="sp-ic"><Icon name="cart" /></span>
          <span className="tx">{toBuy.length
            ? <><b>{plural(toBuy.length, "article", "item")} {t("à acheter", "to buy")}</b><span>{toBuy.slice(0, 3).map(x => x.name).join(", ")}{toBuy.length > 3 ? "…" : ""}</span></>
            : <><b>{t("Ta liste de courses", "Your shopping list")}</b><span>{t("Ce qui manque à une recette s'ajoute en un appui", "What a recipe is missing adds in one tap")}</span></>}</span>
          <Icon name="next" />
        </button>

        <div className="sp-hd"><h2 className="sp-sec">{t("Tes derniers scans", "Your recent scans")}</h2>{history.length > 0 && <button type="button" className="sp-all" onClick={() => navigate("/scans")}>{t("Voir tout", "See all")}<Icon name="next" /></button>}</div>
        {history.length > 0 ? (
          <div className="sp-card sp-list">
            {history.slice(0, 2).map(e => (
              <ScanRow key={e.id} entry={e} locked={!isPlus && daysAgo(e.date) > 7} onClick={() => (!isPlus && daysAgo(e.date) > 7 ? openPaywall("historique") : navigate(`/recettes/${e.id}`))} />
            ))}
          </div>
        ) : (
          <button type="button" className="sp-card sp-line" onClick={openScan}>
            <span className="sp-ic"><Icon name="cam" /></span>
            <span className="tx"><b>{t("Pas encore de scan", "No scan yet")}</b><span>{t("Prends ton frigo en photo : trois recettes avec ce que tu as", "Take a photo of your fridge: three recipes with what you have")}</span></span>
            <Icon name="next" />
          </button>
        )}

        <div className="sp-hd"><h2 className="sp-sec">{t("Tes favoris", "Your favourites")}</h2>{favorites.length > 0 && <button type="button" className="sp-all" onClick={() => navigate("/favoris")}>{t("Voir tout", "See all")}<Icon name="next" /></button>}</div>
        {favs.length > 0 ? <>
          {favorites.length === 0 && <p className="sp-hint">{t(<>Touche <Icon name="heart" /> sur une recette pour la garder ici. Celles de ton dernier scan :</>, <>Tap <Icon name="heart" /> on a recipe to keep it here. From your last scan:</>)}</p>}
          <div className="sp-favs">
            {favs.map(r => <FavCard key={r.title} recipe={r} fav={favorites.length > 0} onClick={() => onOpenRecipe(r)} />)}
          </div>
        </> : (
          <div className="sp-card sp-line">
            <span className="sp-ic"><Icon name="heart" /></span>
            <span className="tx"><b>{t("Tes recettes préférées arriveront ici", "Your favourite recipes will show up here")}</b><span>{t("Touche le cœur sur une recette pour la garder", "Tap the heart on a recipe to keep it")}</span></span>
          </div>
        )}

        <h2 className="sp-sec">{t("Statistiques", "Stats")}</h2>
        <button type="button" className="sp-card sp-line" onClick={bilan}>
          <span className="sp-ic"><Icon name="chart" /></span>
          <span className="tx"><b>{mealsN ? `${plural(mealsN, "repas cuisiné", "meal cooked", "meals cooked")} ${t("ce mois-ci", "this month")}` : t("Aucun repas cuisiné ce mois-ci", "No meals cooked this month")}</b>
            <span>{saved.usedKg > 0 ? t(`Soit ${kilos(saved.usedKg)} de ton frigo cuisinés`, `That's ${kilos(saved.usedKg)} from your fridge cooked`) : t("Touche « J'ai cuisiné ça » à la fin d'une recette", "Tap \"I cooked this\" at the end of a recipe")}</span></span>
          {isPlus ? <Icon name="next" /> : <LockPill />}
        </button>
        {saved.kg > 0 && (
          <div className="sp-hi sp-bravo">
            <span className="sp-hi-ic"><Icon name="leaf" /></span>
            <span className="tx"><b>{t("Bravo !", "Well done!")}</b><span>{t(`Tu as évité ${kilos(saved.kg)} de nourriture à la poubelle ce mois-ci.`, `You kept ${kilos(saved.kg)} of food out of the bin this month.`)}</span></span>
          </div>
        )}
      </div>
      <AppTabBar active="home" isPlus={isPlus} />
    </div>
  );
}
