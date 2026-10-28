// Section « Frigo vide ? Explore. » : l'onglet Explorer de l'appli, refait en HTML d'après les captures de Hugo du 28 octobre
// (l'accueil d'Explorer, puis la catégorie Healthy). Photos : celles du catalogue (recipe-images/catalog/v3), réduites dans
// public/landing/explorer. Textes et temps : ceux du catalogue (supabase/catalogue).
import type { ReactNode } from "react";

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

const CATS = [["toutes", "Toutes"], ["rapides", "Rapides"], ["healthy", "Healthy"], ["budget", "Petit budget"], ["famille", "Famille"], ["desserts", "Desserts"]];
const TOP = [["nachos", "Nachos", "20 min · Facile"], ["hachis-parmentier", "Hachis parmentier", "60 min · Facile"], ["tartiflette", "Tartiflette", "60 min · Facile"]];
const MINE = [["shakshuka", "Shakshuka", "30 min · Facile"], ["taboule", "Taboulé", "20 min · Facile"], ["salade-quinoa", "Salade de quinoa", "25 min · Facile"]];
const HEALTHY = [
  ["chia-pudding", "Chia pudding", "Des graines de chia gonflées dans du lait de coco, avec des fruits frais.", "10 min · Facile · Végé · 3 ingrédients à acheter"],
  ["salade-quinoa", "Salade de quinoa", "Du quinoa avec concombre, tomates, feta et herbes, comme un taboulé.", "25 min · Facile · Végé · 2 ingrédients à acheter"],
  ["buddha-bowl", "Buddha bowl", "Un bol complet et coloré : quinoa, pois chiches rôtis, légumes, avocat et sauce au tahin.", "35 min · Facile · Végé · 4 ingrédients à acheter"],
];

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
        <div className="xp-head"><b>Explorer</b><span>Des idées pour tous les goûts</span></div>
        <div className="xp-body">
          <div className="xp-search"><span><Ic name="search" />Rechercher une recette ou un ingrédient…</span><Ic name="sliders" /></div>
          <div className="xp-cats">
            {CATS.map(([id, name]) => (
              <span key={id} className={id === cat ? "on" : undefined}><img src={`${IMG}/cat-${id}.webp`} alt="" width={52} height={52} loading="lazy" />{name}</span>
            ))}
          </div>
          {children}
        </div>
        <div className="xp-tabs">
          <span><Ic name="home" />Accueil</span>
          <span className="on"><Ic name="search" />Explorer</span>
          <span className="xp-scan"><Ic name="cam" /></span>
          <span><Ic name="cal" />Planning</span>
          <span><Ic name="fridge" />Ma cuisine</span>
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
            <span className="k">Explorer</span>
            <h2>Frigo vide ? <em>Explore.</em></h2>
            <p className="lede">Pas d'idée, ou envie d'un plat précis ? Cherche une recette ou un ingrédient. Frigia te dit ce que tu as déjà et ce qu'il reste à acheter.</p>
          </div>
          <ul className="xp-points">
            <li><b>La recette du jour et le Top 10.</b> Des idées qui changent chaque jour, à parcourir par envie : rapide, healthy, petit budget, famille ou dessert.</li>
            <li><b>Un plat précis, trois versions.</b> Tape « tartiflette » : tu as la classique, une plus légère et une végétarienne.</li>
            <li><b>Avec ce que tu as.</b> Des idées tirées de ta cuisine. Sur chaque recette, tu vois combien d'ingrédients il te manque.</li>
          </ul>
          <div className="xp-cta">
            <button className="btn btn-fill" onClick={() => onStart("explorer")}>{cta}</button>
            <span className="fine">Compris dans Frigia Plus, et dans les 7 jours d'essai.</span>
          </div>
        </div>

        <div className="xp-phones">
          <Phone cat="toutes" label="L'écran Explorer de l'appli : la recherche, les catégories, la recette du jour (endives au jambon) et le Top 10 du moment (nachos, hachis parmentier, tartiflette)">
            <span className="xp-hero">
              <img src={`${IMG}/endives-au-jambon.webp`} alt="" width={560} height={560} loading="lazy" />
              <span className="xp-hero-tx">
                <small>La recette du jour</small>
                <b>Endives au jambon</b>
                <span>60 min · Facile · et ses variantes</span>
                <span className="xp-go">Voir la recette <Ic name="next" /></span>
              </span>
            </span>
            <span className="xp-hd"><b>Top 10 du moment</b></span>
            <span className="xp-row">
              {TOP.map(([img, title, sub], i) => (
                <span className="xp-top" key={img}><span className="xp-num">{i + 1}</span><Poster img={img} title={title} sub={sub} /></span>
              ))}
            </span>
            <span className="xp-hd"><b>Avec ce que tu as</b><u>Tout voir</u></span>
            <span className="xp-row">{MINE.map(([img, title, sub]) => <Poster key={img} img={img} title={title} sub={sub} />)}</span>
          </Phone>

          <Phone cat="healthy" label="La catégorie Healthy dans Explorer : chia pudding, salade de quinoa et buddha bowl, avec le temps, la difficulté et le nombre d'ingrédients à acheter">
            <span className="xp-hd"><b>Healthy</b><u>Effacer</u></span>
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
