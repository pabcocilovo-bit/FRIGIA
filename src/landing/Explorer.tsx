// Section « Frigo vide ? Explore. » : l'onglet Explorer de l'appli, refait en HTML d'après les captures de Hugo du 28 octobre
// (l'accueil d'Explorer, puis la catégorie Healthy). Photos : celles du catalogue (recipe-images/catalog/v3), réduites dans
// public/landing/explorer. Textes et temps : ceux du catalogue (supabase/catalogue).
import type { ReactNode } from "react";
import { t } from "../lib/i18n";

const IMG = "/landing/explorer";

// Les icônes de l'appli (src/ui/icons.ts), en ligne : la landing ne charge pas les composants de l'appli
const ICONS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  next: <path d="M9 5l7 7-7 7" />,
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  cam: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  cal: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  fridge: <><rect x="6" y="3" width="12" height="18" rx="2.5" /><path d="M6 10h12M9.5 6v1.5M9.5 13v3" /></>,
};
type IconName = keyof typeof ICONS;
const Ic = ({ name }: { name: IconName }) => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>
);

const EASY = t("Facile", "Easy");
const CATS = t([["toutes", "Toutes"], ["rapides", "Rapides"], ["healthy", "Healthy"], ["budget", "Petit budget"], ["famille", "Famille"], ["desserts", "Desserts"]],
  [["toutes", "All"], ["rapides", "Quick"], ["healthy", "Healthy"], ["budget", "Budget"], ["famille", "Family"], ["desserts", "Desserts"]]);
const TOP = [["nachos", "Nachos", `20 min · ${EASY}`], ["hachis-parmentier", t("Hachis parmentier", "Shepherd's pie"), `60 min · ${EASY}`], ["tartiflette", "Tartiflette", `60 min · ${EASY}`]];
const MINE = [["shakshuka", "Shakshuka", `30 min · ${EASY}`], ["taboule", t("Taboulé", "Tabbouleh"), `20 min · ${EASY}`], ["salade-quinoa", t("Salade de quinoa", "Quinoa salad"), `25 min · ${EASY}`]];
const HEALTHY = t([
  ["chia-pudding", "Chia pudding", "Des graines de chia gonflées dans du lait de coco, avec des fruits frais.", "10 min · Facile · Végé · 3 ingrédients à acheter"],
  ["salade-quinoa", "Salade de quinoa", "Du quinoa avec concombre, tomates, feta et herbes, comme un taboulé.", "25 min · Facile · Végé · 2 ingrédients à acheter"],
  ["buddha-bowl", "Buddha bowl", "Un bol complet et coloré : quinoa, pois chiches rôtis, légumes, avocat et sauce au tahin.", "35 min · Facile · Végé · 4 ingrédients à acheter"],
], [
  ["chia-pudding", "Chia pudding", "Chia seeds soaked in coconut milk, with fresh fruit.", "10 min · Easy · Veggie · 3 ingredients to buy"],
  ["salade-quinoa", "Quinoa salad", "Quinoa with cucumber, tomatoes, feta and herbs, like a tabbouleh.", "25 min · Easy · Veggie · 2 ingredients to buy"],
  ["buddha-bowl", "Buddha bowl", "A full, colourful bowl: quinoa, roasted chickpeas, vegetables, avocado and tahini sauce.", "35 min · Easy · Veggie · 4 ingredients to buy"],
]);

const Poster = ({ img, title, sub }: { img: string; title: string; sub: string }) => (
  <span className="xp-poster"><img src={`${IMG}/${img}.webp`} alt="" width={280} height={280} loading="lazy" /><span className="xp-pt"><b>{title}</b><small>{sub}</small></span></span>
);

// Le téléphone : l'en-tête vert, la recherche, les catégories, l'écran, la barre d'onglets.
// Une image pour les lecteurs d'écran (role="img") : son contenu est décrit par label, et repris dans le texte à côté.
function Phone({ label, cat, children }: { label: string; cat: string; children: ReactNode }) {
  return (
    <div className="xp-phone" role="img" aria-label={label}>
      <div className="xp-screen">
        <div className="xp-status"><b>18:42</b><i className="xp-island" /><span className="xp-sig"><i /><i /><i /><i /></span><span className="xp-bat" /></div>
        <div className="xp-head"><b>{t("Explorer", "Explore")}</b><span>{t("Des idées pour tous les goûts", "Ideas for every taste")}</span></div>
        <div className="xp-body">
          <div className="xp-search"><span><Ic name="search" />{t("Rechercher une recette ou un ingrédient…", "Search a recipe or an ingredient…")}</span><Ic name="sliders" /></div>
          <div className="xp-cats">
            {CATS.map(([id, name]) => (
              <span key={id} className={id === cat ? "on" : undefined}><img src={`${IMG}/cat-${id}.webp`} alt="" width={52} height={52} loading="lazy" />{name}</span>
            ))}
          </div>
          {children}
        </div>
        <div className="xp-tabs">
          <span><Ic name="home" />{t("Accueil", "Home")}</span>
          <span className="on"><Ic name="search" />{t("Explorer", "Explore")}</span>
          <span className="xp-scan"><Ic name="cam" /></span>
          <span><Ic name="cal" />{t("Planning", "Plan")}</span>
          <span><Ic name="fridge" />{t("Ma cuisine", "My kitchen")}</span>
        </div>
      </div>
    </div>
  );
}

// cta : le libellé du bouton (« Essayer 7 jours », ou celui de la liste d'attente) ; onStart reçoit la source du clic
export function Explorer({ onStart, cta }: { onStart: (source: string) => void; cta: string }) {
  return (
    <section className="explore" id="explorer">
      <div className="container xp-grid">
        <div className="xp-txt">
          <div className="sh">
            <span className="k">{t("Explorer", "Explore")}</span>
            <h2>{t(<>Frigo vide ? <em>Explore.</em></>, <>Empty fridge? <em>Explore.</em></>)}</h2>
            <p className="lede">{t("Pas d'idée, ou envie d'un plat précis ? Cherche une recette ou un ingrédient. Frigia te dit ce que tu as déjà et ce qu'il reste à acheter.", "No ideas, or craving a particular dish? Search for a recipe or an ingredient. Frigia tells you what you already have and what's left to buy.")}</p>
          </div>
          <ul className="xp-points">{t(<>
            <li><b>La recette du jour et le Top 10.</b> Des idées qui changent chaque jour, à parcourir par envie : rapide, healthy, petit budget, famille ou dessert.</li>
            <li><b>Un plat précis, trois versions.</b> Tape « tartiflette » : tu as la classique, une plus légère et une végétarienne.</li>
            <li><b>Avec ce que tu as.</b> Des idées tirées de ta cuisine. Sur chaque recette, tu vois combien d'ingrédients il te manque.</li>
          </>, <>
            <li><b>The recipe of the day and the Top 10.</b> Ideas that change every day, to browse by mood: quick, healthy, budget, family or dessert.</li>
            <li><b>One dish, three versions.</b> Type "tartiflette": you get the classic, a lighter one and a vegetarian one.</li>
            <li><b>With what you have.</b> Ideas drawn from your kitchen. On every recipe, you see how many ingredients you're missing.</li>
          </>)}</ul>
          <div className="xp-cta">
            <button className="btn btn-fill" onClick={() => onStart("explorer")}>{cta}</button>
            <span className="fine">{t("Compris dans Frigia Plus, et dans l'essai gratuit.", "Included in Frigia Plus, and in the free trial.")}</span>
          </div>
        </div>

        <div className="xp-phones">
          <Phone cat="toutes" label={t("L'écran Explorer de l'appli : la recherche, les catégories, la recette du jour (endives au jambon) et le Top 10 du moment (nachos, hachis parmentier, tartiflette)", "The app's Explore screen: search, categories, the recipe of the day (chicory and ham gratin) and the Top 10 right now (nachos, shepherd's pie, tartiflette)")}>
            <span className="xp-hero">
              <img src={`${IMG}/endives-au-jambon.webp`} alt="" width={560} height={560} loading="lazy" />
              <span className="xp-hero-tx">
                <small>{t("La recette du jour", "Recipe of the day")}</small>
                <b>{t("Endives au jambon", "Chicory and ham gratin")}</b>
                <span>{t("60 min · Facile · et ses variantes", "60 min · Easy · and its variations")}</span>
                <span className="xp-go">{t("Voir la recette", "See the recipe")} <Ic name="next" /></span>
              </span>
            </span>
            <span className="xp-hd"><b>{t("Top 10 du moment", "Top 10 right now")}</b></span>
            <span className="xp-row">
              {TOP.map(([img, title, sub], i) => (
                <span className="xp-top" key={img}><span className="xp-num">{i + 1}</span><Poster img={img} title={title} sub={sub} /></span>
              ))}
            </span>
            <span className="xp-hd"><b>{t("Avec ce que tu as", "With what you have")}</b><u>{t("Tout voir", "See all")}</u></span>
            <span className="xp-row">{MINE.map(([img, title, sub]) => <Poster key={img} img={img} title={title} sub={sub} />)}</span>
          </Phone>

          <Phone cat="healthy" label={t("La catégorie Healthy dans Explorer : chia pudding, salade de quinoa et buddha bowl, avec le temps, la difficulté et le nombre d'ingrédients à acheter", "The Healthy category in Explore: chia pudding, quinoa salad and buddha bowl, with time, difficulty and the number of ingredients to buy")}>
            <span className="xp-hd"><b>Healthy</b><u>{t("Effacer", "Clear")}</u></span>
            {HEALTHY.map(([img, title, text, meta]) => (
              <span className="xp-res" key={img}>
                <img src={`${IMG}/${img}.webp`} alt="" width={560} height={560} loading="lazy" />
                <span className="xp-res-tx"><b>{title}</b><span>{text}</span><small>{meta}</small></span>
              </span>
            ))}
          </Phone>
        </div>
      </div>
    </section>
  );
}
