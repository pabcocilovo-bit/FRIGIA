import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import "./landing/landing.css";
import { AuthSheet, type AuthMode } from "./landing/AuthSheet";
import { LegalSheet, type LegalKey } from "./landing/legal";
import { GoogleInAppBar, InstallSheet, SocialInAppScreen } from "./landing/InApp";
import { InstallSection } from "./landing/InstallSection";
import { FAQ } from "./landing/faq";
import { Explorer } from "./landing/Explorer";
import { Tonight } from "./landing/Tonight";
import { WaitlistSheet } from "./landing/Waitlist";
import { SIGNUP_OPEN } from "./lib/launch";
import { RECIPES, fridgeScore } from "./landing/recipes";
import { LEGAL } from "./legal/pages";
import { detectInAppBrowser, isStandalone, type InstallPromptEvent } from "./landing/browser";

// Landing V5 (refonte d'octobre 2026). Les textes décrivent les offres de la refonte :
// 7 jours d'essai sans carte, puis Frigia Plus : plus de formule gratuite depuis le 23 octobre.
// Ni code ni prix fondateur sur le site (demandé par Hugo le 23 octobre) : ils restent dans les CGV et dans l'appli.
//
// onStart / onLogin : branchés par l'appli sur son parcours d'inscription quand il existera.
// Sans eux, la landing ouvre sa propre feuille de connexion (Supabase), comme l'ancienne version.
export type Plan = "free" | "plus";

// Liste d'attente tant que l'appli n'est pas ouverte à tous (src/lib/launch.ts) : tous les boutons d'inscription
// l'ouvrent, seule la connexion reste. Le lien ?invitation, que tout le monde pouvait taper, ne rouvre plus l'inscription :
// les invitations par email viendront avec un vrai lien (Hugo, 28 octobre).
const WAITLIST = !SIGNUP_OPEN;
// /?liste (WAITLIST_URL) : la liste d'attente s'ouvre tout de suite (depuis la connexion ou l'appli installée)
const openList = () => WAITLIST && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("liste");
const JOIN = "Rejoindre la liste d'attente";
type Props = { onStart?: (plan: Plan) => void; onLogin?: () => void };

const IMG = "/landing";
const CREAM = "#F5EFE3";

// ── Hero : la photo du frigo devient trois idées ─────────────────────────────
// Positions des ingrédients sur public/landing/frigo.jpg, en % de la photo
const PINS: { name: string; x: number; y: number; up?: boolean }[] = [
  { name: "Poivrons", x: 22, y: 37 },
  { name: "Brocoli", x: 50, y: 36 },
  { name: "Carottes", x: 20, y: 48 },
  { name: "Tomates", x: 44, y: 51 },
  { name: "Courgettes", x: 64, y: 61, up: true },
  { name: "Œufs", x: 21, y: 63 },
];
// Les mêmes recettes que la section « Avec ce frigo-là » plus bas
const HERO_IDEAS = ["penne", "gratin", "omelette"].map(id => {
  const r = RECIPES[id], s = fridgeScore(r);
  return [r.photo, r.name, `${r.minutes} min · ${s.inFridge}/${s.total} dans ton frigo${s.missing ? ` · manque ${s.missing}` : ""}`];
});

function HeroArt() {
  return (
    <div className="art">
      <div className="art-bg" aria-hidden="true" />
      <figure className="shot">
        <img src={`${IMG}/frigo.jpg`} alt="Un frigo ouvert : poivrons, brocoli, carottes, tomates cerises, œufs et courgettes" width={640} height={969} fetchPriority="high" />
        <span className="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span className="sweep" aria-hidden="true" />
        {PINS.map((p, i) => (
          <span key={p.name} className={p.up ? "pin up" : "pin"} style={{ left: `${p.x}%`, top: `${p.y}%`, "--d": `${1.3 + i * 0.22}s` } as CSSProperties} aria-hidden="true">
            <b>{p.name}</b>
          </span>
        ))}
        <span className="count">8 ingrédients repérés</span>
      </figure>
      <div className="ideas" aria-label="Exemple : trois idées proposées avec ce frigo">
        <span className="k">Pour 4 · ce soir</span>
        <h3>Trois idées <em>avec ton frigo</em></h3>
        {HERO_IDEAS.map(([img, name, meta], i) => (
          <div className="rec" key={img} style={{ "--d": `${3 + i * 0.15}s` } as CSSProperties}>
            <img src={`${IMG}/${img}.jpg`} alt="" width={56} height={56} />
            <div><b>{name}</b><small>{meta}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comment ça marche : 3 cartes avec les vrais écrans de l'appli ────────────
const STEPS = [
  { n: "Un.", img: "app-scan", alt: "L'écran de scan : le frigo dans le viseur, avec le choix plat ou dessert", t: "Tu prends ton frigo en photo.", p: "Pour un plat ou un dessert. Une photo de ta galerie marche aussi, pas besoin de ranger avant." },
  { n: "Deux.", img: "app-ingr", alt: "L'écran « C'est bien ça ? » : 8 ingrédients trouvés, puis qui mange ce soir avec Camille, Thomas, Léo et Jade", t: "Tu vérifies, tu dis qui mange.", p: "Frigia liste ce qu'il a vu, avec les quantités. Tu corriges d'un geste et tu choisis qui est à table, allergies comprises." },
  { n: "Trois.", img: "app-results", alt: "L'écran « Trois idées pour ce soir » avec des penne aux légumes rôtis", t: "Tu choisis parmi trois recettes.", p: "Avec ce que tu as déjà, en commençant par ce qui se périme. Le mode cuisine te guide pas à pas." },
];

function HowItWorks() {
  return (
    <section className="how rule" id="comment">
      <div className="container">
        <div className="sh"><span className="k">Comment ça marche</span><h2>Du frigo à l'assiette, <em>en trois temps.</em></h2><p className="lede">Pas de liste de quinze ingrédients ni de recette à chercher. Tu montres ce que tu as, Frigia s'occupe du reste.</p></div>
        <ol className="trio">
          {STEPS.map(s => (
            <li className="tcard" key={s.n}>
              <div className="tvis"><img src={`${IMG}/${s.img}.jpg`} alt={s.alt} width={600} height={1300} loading="lazy" /></div>
              <div className="ttxt"><span className="num">{s.n}</span><h3>{s.t}</h3><p>{s.p}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Prix : une seule carte Frigia Plus. L'essai, c'est tout Plus : plus de colonne à comparer
// (demandé par Hugo le 23 octobre, à la place des cartes Essai et Plus).
const FEATURES = [
  "Scans du frigo illimités",
  "Mode famille, enfants compris",
  "Planning de la semaine",
  "Liste de courses",
  "Économies du mois",
  "Tout ton historique",
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Landing({ onStart, onLogin }: Props) {
  const { isGoogleApp, isSocialApp, isIos, isAndroid } = detectInAppBrowser();
  const [auth, setAuth] = useState<AuthMode | null>(null);
  const [legal, setLegal] = useState<LegalKey | null>(null);
  const [installHint, setInstallHint] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [gbarClosed, setGbarClosed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Liste d'attente ouverte, avec le bouton d'où elle vient (« hero », « prix »…)
  const [waitlist, setWaitlist] = useState<string | null>(() => (openList() ? "connexion" : null));
  const turnstile = useRef<TurnstileInstance>(null);
  const resetCaptcha = () => { turnstile.current?.reset(); setCaptchaToken(null); };

  // index.html contient une copie pré-rendue de la landing (scripts/prerender.mjs), lisible sans JavaScript
  // par Google et les assistants IA. On la retire dès que la vraie landing est montée, avant l'affichage.
  useLayoutEffect(() => { document.getElementById("prerender")?.remove(); }, []);

  // Fond crème jusque sous la barre d'état et au rebond du défilement, rendu à l'appli en sortant
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const before = { bg: document.body.style.background, theme: meta?.content };
    document.body.style.background = CREAM;
    meta?.setAttribute("content", CREAM);
    return () => {
      document.body.style.background = before.bg;
      if (meta && before.theme) meta.setAttribute("content", before.theme);
    };
  }, []);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallPrompt(e as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (isSocialApp && (isIos || isAndroid)) {
    return <div className="lp"><SocialInAppScreen /></div>;
  }

  // source : quel bouton a été touché, envoyé avec l'inscription à la liste d'attente
  const start = (plan: Plan = "free", source = "hero") => {
    if (WAITLIST) { setAuth(null); setWaitlist(source); return; }
    if (onStart) onStart(plan); else setAuth("signup");
  };
  const login = () => { setWaitlist(null); if (onLogin) onLogin(); else setAuth("login"); };
  const internalAuth = !onStart || !onLogin;
  const showGbar = isGoogleApp && (isIos || isAndroid) && !gbarClosed;
  const canInstall = !isStandalone();

  const install = async () => {
    if (!installPrompt) { setInstallHint(true); return; }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <div className="lp">
      {showGbar && <GoogleInAppBar isIos={isIos} onDismiss={() => setGbarClosed(true)} />}

      <div className="promo">7 jours d'essai, sans carte bancaire · Puis <b>Frigia Plus</b>, sans engagement</div>
      <header className="nav">
        <div className="container">
          <a className="home" href="#top" aria-label="Frigia, accueil"><img src={`${IMG}/frigia-logo.svg`} alt="Frigia" width={84} height={30} /></a>
          <nav className="links" aria-label="Navigation"><a href="#comment">Comment ça marche</a><a href="#plus">Frigia Plus</a><a href="#prix">Prix</a><a href="#faq">Questions</a></nav>
          <div className="right">
            {canInstall && (
              <button className="btn btn-soft get-app" onClick={install} aria-label="Télécharger l'app">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>Télécharger l'app</span>
              </button>
            )}
            {!WAITLIST && <button className="login-short" onClick={login}>Connexion</button>}
            <button className="btn btn-line" onClick={login}>{WAITLIST ? "Se connecter" : "J'ai déjà un compte"}</button>
            {WAITLIST
              ? <button className="btn btn-fill" onClick={() => start("free", "menu")} aria-label={JOIN}><span className="join-long">{JOIN}</span><span className="join-short">Liste d'attente</span></button>
              : <button className="btn btn-fill" onClick={() => start()}>Commencer</button>}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container">
            <div className="copy">
              <span className="k">Pour les soirs de semaine</span>
              <h1>Une photo du frigo, <em>trois idées</em> pour ce soir.</h1>
              <p className="lede">Fini le « on mange quoi ce soir ? ». Frigia repère ce qu'il y a dans ton frigo et te propose trois recettes avec ce que tu as déjà, pour toute la famille.</p>
              <div className="ctas"><button className="btn btn-fill" onClick={() => start("free", "hero")}>{WAITLIST ? JOIN : "Essayer 7 jours"}</button><a className="link" href="#comment">Voir comment ça marche</a></div>
              {WAITLIST && (
                <div className="wl-note">
                  <p>Ouverture par petits groupes. Les premiers inscrits passent en premier.</p>
                  <button onClick={login}>Déjà invité ? Se connecter</button>
                </div>
              )}
              <div className="reassure"><span className="chip plain">Sans carte bancaire</span><span className="chip plain">7 jours d'essai</span><span className="chip plain">Rien à télécharger</span></div>
            </div>
            <HeroArt />
          </div>
        </section>

        <HowItWorks />
        <Tonight onStart={source => start("free", source)} cta={WAITLIST ? JOIN : undefined} />
        <Explorer onStart={source => start("free", source)} cta={WAITLIST ? JOIN : "Essayer 7 jours"} />

        <section className="plus rule" id="plus">
          <div className="container">
            <div className="sh"><span className="k">Frigia Plus</span><h2>Pensé pour <em>toute la famille.</em></h2><p className="lede">Tout est compris dès l'essai : le scan, et ce qui change la semaine d'un foyer, la famille, le planning, la liste de courses et ce que tu économises.</p></div>
            <div className="feats">
              <div className="feat"><div className="ill" aria-hidden="true"><span className="av">C</span><span className="av">T</span><span className="av">L</span><span className="av guest-av">+1</span></div><h3>Mode <em>famille</em></h3><p>Un profil par personne, enfants compris, avec allergies et « n'aime pas ». Les portions se calculent toutes seules.</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><div className="days"><span className="p">Lun</span><span className="p">Mar</span><span>Mer</span><span className="p">Jeu</span><span className="p">Ven</span><span>Sam</span><span>Dim</span></div></div><h3>Ta <em>semaine</em></h3><p>À partir d'un scan, les repas de la semaine qui utilisent d'abord ce qui se périme vite. Les restes sont prévus.</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><span className="chip">Parmesan</span><span className="chip">Basilic</span><span className="chip plain">+2</span></div><h3>Liste de <em>courses</em></h3><p>Seulement ce qui manque, à cocher en magasin ou à envoyer par SMS ou WhatsApp.</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><span className="chip plain">Toutes</span><span className="chip plain">Moins de 20 min</span></div><h3>Autres <em>idées</em></h3><p>Trois nouvelles recettes sur le même scan, sans utiliser un nouveau scan.</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><span className="badge">Mardi soir</span><span className="chip">Penne aux légumes</span></div><h3>Le plat <em>du jour</em></h3><p>Si un plat est prévu, il t'attend sur l'accueil. Tu coches qui mange et tu lances la cuisson.</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><span className="unit">€</span><span className="unit">kg</span></div><h3>Ton <em>bilan</em></h3><p>Chaque mois, ce que tu as évité de jeter, en euros et en kilos. Scans illimités et tout l'historique.</p></div>
            </div>
          </div>
        </section>

        <section className="save rule">
          <div className="container grid">
            <div className="sh">
              <span className="k">Moins de gaspi</span>
              <h2>Ce que tu cuisines, <em>tu ne le jettes pas.</em></h2>
              <p className="lede">Tu jettes environ 100 € de nourriture par an et par personne. Frigia t'aide à les garder : chaque recette part de ce qui est déjà dans ton frigo, en commençant par ce qui se périme.</p>
              <p className="source">Source : ADEME.</p>
            </div>
            <div className="report">
              <div className="head"><span className="k">Ton bilan · exemple</span><span className="badge">Plus</span></div>
              <div><div className="big">22,60 €</div><p className="muted">sauvés ce mois-ci</p></div>
              <div className="tiles"><div><b>−3,6 kg</b><small>de nourriture à la poubelle</small></div><div><b>6</b><small>repas cuisinés avec ton frigo</small></div></div>
              <p className="source">Exemple tiré de l'appli. Le tien se calcule avec tes vrais repas.</p>
            </div>
          </div>
        </section>

        <section className="price rule" id="prix">
          <div className="container">
            <div className="sh"><span className="k">{WAITLIST ? "Prix à l'ouverture" : "Prix"}</span><h2>Essaie 7 jours, <em>puis passe à Plus.</em></h2><p className="lede">Pas de carte bancaire pour essayer, et rien n'est débité à la fin de l'essai. Plus est sans engagement.</p></div>
            <div className="offer">
              <div className="offer-main">
                <div className="top"><span className="k">Frigia Plus</span><span className="badge">7 jours offerts</span></div>
                <div className="amount">39,99 €<small>par an</small></div>
                <div className="sub"><span>Ou 6,99 € par mois</span><span>Résiliable en 3 clics</span></div>
                <div className="foot"><button className="btn btn-cream" onClick={() => start("free", "prix")}>{WAITLIST ? JOIN : "Essayer 7 jours"}</button><span className="fine">Sans engagement. Paiement sécurisé par Stripe.</span></div>
              </div>
              <ul aria-label="Compris dans Frigia Plus">{FEATURES.map(f => <li key={f}><span className="yes" aria-hidden="true">✓</span>{f}</li>)}</ul>
            </div>
          </div>
        </section>

        {canInstall && <InstallSection onInstall={install} />}

        <section className="faq rule" id="faq">
          <div className="container grid">
            <div className="sh"><span className="k">Questions</span><h2>Ce qu'on <em>nous demande.</em></h2></div>
            <div>
              {FAQ.map(f => (
                <details key={f.id}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                  {f.id === "appli" && canInstall && <a className="link" href="#installer">Voir comment l'ajouter</a>}
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <div className="big"><h2>Ce soir, commence par <em>ouvrir le frigo.</em></h2><button className="btn btn-cream" onClick={() => start("free", "fin")}>{WAITLIST ? JOIN : "Essayer 7 jours"}</button></div>
          <div className="base">
            <img src={`${IMG}/frigia-logo-inverse.svg`} alt="Frigia" width={78} height={28} />
            <nav className="legal" aria-label="Informations légales">
              {LEGAL.map(p => <a key={p.key} href={`/${p.slug}`}>{p.tab}</a>)}
              <a href="mailto:contact@frigia.fr">Contact</a>
            </nav>
          </div>
        </div>
      </footer>

      {auth && <AuthSheet initialMode={auth} captchaToken={captchaToken} onResetCaptcha={resetCaptcha} onLegal={setLegal} onClose={() => setAuth(null)}
        onWaitlist={WAITLIST ? () => { setAuth(null); setWaitlist("connexion"); } : undefined} />}
      {waitlist && <WaitlistSheet source={waitlist} onLogin={login} onClose={() => setWaitlist(null)} />}
      {legal && <LegalSheet initial={legal} onClose={() => setLegal(null)} />}
      {installHint && <InstallSheet onClose={() => setInstallHint(false)} />}
      {internalAuth && (
        <Turnstile ref={turnstile} siteKey="0x4AAAAAADcyx1Wtay8saMMq" onSuccess={setCaptchaToken} onExpire={resetCaptcha} options={{ size: "invisible" }} />
      )}
    </div>
  );
}
