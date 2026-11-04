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
import { inAlpha, trialPitch, tryLabel } from "./lib/alpha";
import { RECIPES, fridgeScore } from "./landing/recipes";
import { LEGAL } from "./legal/pages";
import { detectInAppBrowser, isStandalone, type InstallPromptEvent } from "./landing/browser";
import { SITE_KEY } from "./app/onboarding/captcha";
import { t } from "./lib/i18n";

// Landing V5 (refonte d'octobre 2026). Les textes décrivent les offres de la refonte :
// 7 jours d'essai sans carte, puis Frigia Plus : plus de formule gratuite depuis le 23 octobre.
// Pendant l'alpha (src/lib/alpha.ts) : gratuit pour tout le monde jusqu'au 30 novembre, et c'est dit en haut.
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
const JOIN = t("Rejoindre la liste d'attente", "Join the waiting list");
type Props = { onStart?: (plan: Plan) => void; onLogin?: () => void };

const IMG = "/landing";
const CREAM = "#F5EFE3";

// ── Hero : la photo du frigo devient trois idées ─────────────────────────────
// Positions des ingrédients sur public/landing/frigo.jpg, en % de la photo
const PINS: { name: string; x: number; y: number; up?: boolean }[] = [
  { name: t("Poivrons", "Peppers"), x: 22, y: 37 },
  { name: t("Brocoli", "Broccoli"), x: 50, y: 36 },
  { name: t("Carottes", "Carrots"), x: 20, y: 48 },
  { name: t("Tomates", "Tomatoes"), x: 44, y: 51 },
  { name: "Courgettes", x: 64, y: 61, up: true },
  { name: t("Œufs", "Eggs"), x: 21, y: 63 },
];
// Les mêmes recettes que la section « Avec ce frigo-là » plus bas
const HERO_IDEAS = ["penne", "gratin", "omelette"].map(id => {
  const r = RECIPES[id], s = fridgeScore(r);
  return [r.photo, r.name, `${r.minutes} min · ${s.inFridge}/${s.total} ${t("dans ton frigo", "in your fridge")}${s.missing ? ` · ${t("manque", "missing")} ${s.missing}` : ""}`];
});

function HeroArt() {
  return (
    <div className="art">
      <div className="art-bg" aria-hidden="true" />
      <figure className="shot">
        <img src={`${IMG}/frigo.jpg`} alt={t("Un frigo ouvert : poivrons, brocoli, carottes, tomates cerises, œufs et courgettes", "An open fridge: peppers, broccoli, carrots, cherry tomatoes, eggs and courgettes")} width={640} height={969} fetchPriority="high" />
        <span className="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span className="sweep" aria-hidden="true" />
        {PINS.map((p, i) => (
          <span key={p.name} className={p.up ? "pin up" : "pin"} style={{ left: `${p.x}%`, top: `${p.y}%`, "--d": `${1.3 + i * 0.22}s` } as CSSProperties} aria-hidden="true">
            <b>{p.name}</b>
          </span>
        ))}
        <span className="count">{t("8 ingrédients repérés", "8 ingredients spotted")}</span>
      </figure>
      <div className="ideas" aria-label={t("Exemple : trois idées proposées avec ce frigo", "Example: three ideas suggested with this fridge")}>
        <span className="k">{t("Pour 4 · ce soir", "For 4 · tonight")}</span>
        <h3>{t(<>Trois idées <em>avec ton frigo</em></>, <>Three ideas <em>from your fridge</em></>)}</h3>
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
const STEPS = t([
  { n: "Un.", img: "app-scan", alt: "L'écran de scan : le frigo dans le viseur, avec le choix plat ou dessert", t: "Tu prends ton frigo en photo.", p: "Pour un plat ou un dessert. Une photo de ta galerie marche aussi, pas besoin de ranger avant." },
  { n: "Deux.", img: "app-ingr", alt: "L'écran « C'est bien ça ? » : 8 ingrédients trouvés, puis qui mange ce soir avec Camille, Thomas, Léo et Jade", t: "Tu vérifies, tu dis qui mange.", p: "Frigia liste ce qu'il a vu, avec les quantités. Tu corriges d'un geste et tu choisis qui est à table, allergies comprises." },
  { n: "Trois.", img: "app-results", alt: "L'écran « Trois idées pour ce soir » avec des penne aux légumes rôtis", t: "Tu choisis parmi trois recettes.", p: "Avec ce que tu as déjà, en commençant par ce qui se périme. Le mode cuisine te guide pas à pas." },
], [
  { n: "One.", img: "app-scan", alt: "The scan screen: the fridge in the viewfinder, with the choice of main or dessert", t: "You take a photo of your fridge.", p: "For a main or a dessert. A photo from your gallery works too, no need to tidy up first." },
  { n: "Two.", img: "app-ingr", alt: "The \"Is that right?\" screen: 8 ingredients found, then who's eating tonight with Camille, Thomas, Léo and Jade", t: "You check, and say who's eating.", p: "Frigia lists what it saw, with quantities. You fix things in one tap and choose who's at the table, allergies included." },
  { n: "Three.", img: "app-results", alt: "The \"Three ideas for tonight\" screen with roasted vegetable penne", t: "You pick from three recipes.", p: "With what you already have, starting with what goes off first. Cooking mode guides you step by step." },
]);

function HowItWorks() {
  return (
    <section className="how rule" id="comment">
      <div className="container">
        <div className="sh"><span className="k">{t("Comment ça marche", "How it works")}</span><h2>{t(<>Du frigo à l'assiette, <em>en trois temps.</em></>, <>From fridge to plate, <em>in three steps.</em></>)}</h2><p className="lede">{t("Pas de liste de quinze ingrédients ni de recette à chercher. Tu montres ce que tu as, Frigia s'occupe du reste.", "No list of fifteen ingredients, no recipe to hunt for. You show what you have, Frigia does the rest.")}</p></div>
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
const FEATURES = t([
  "Scans du frigo illimités",
  "Mode famille, enfants compris",
  "Planning de la semaine",
  "Liste de courses",
  "Économies du mois",
  "Tout ton historique",
], [
  "Unlimited fridge scans",
  "Family mode, kids included",
  "Weekly meal plan",
  "Shopping list",
  "Monthly savings",
  "Your full history",
]);

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

      <div className="promo">{inAlpha()
        ? t(<><b>Version alpha</b> · Gratuit pour tout le monde jusqu'au 30 novembre, sans carte bancaire</>, <><b>Alpha version</b> · Free for everyone until November 30, no card needed</>)
        : t(<>7 jours d'essai, sans carte bancaire · Puis <b>Frigia Plus</b>, sans engagement</>, <>7-day trial, no card needed · Then <b>Frigia Plus</b>, cancel anytime</>)}</div>
      <header className="nav">
        <div className="container">
          <a className="home" href="#top" aria-label={t("Frigia, accueil", "Frigia, home")}><img src={`${IMG}/frigia-logo.svg`} alt="Frigia" width={84} height={30} /></a>
          <nav className="links" aria-label="Navigation"><a href="#comment">{t("Comment ça marche", "How it works")}</a><a href="#plus">Frigia Plus</a><a href="#prix">{t("Prix", "Pricing")}</a><a href="#faq">{t("Questions", "FAQ")}</a></nav>
          <div className="right">
            {canInstall && (
              <button className="btn btn-soft get-app" onClick={install} aria-label={t("Télécharger l'app", "Get the app")}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>{t("Télécharger l'app", "Get the app")}</span>
              </button>
            )}
            {!WAITLIST && <button className="login-short" onClick={login}>{t("Connexion", "Log in")}</button>}
            <button className="btn btn-line" onClick={login}>{WAITLIST ? t("Se connecter", "Log in") : t("J'ai déjà un compte", "I have an account")}</button>
            {WAITLIST
              ? <button className="btn btn-fill" onClick={() => start("free", "menu")} aria-label={JOIN}><span className="join-long">{JOIN}</span><span className="join-short">{t("Liste d'attente", "Waiting list")}</span></button>
              : <button className="btn btn-fill" onClick={() => start()}>{t("Commencer", "Get started")}</button>}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container">
            <div className="copy">
              <span className="k">{t("Pour les soirs de semaine", "For weeknights")}</span>
              <h1>{t(<>Une photo du frigo, <em>trois idées</em> pour ce soir.</>, <>One photo of your fridge, <em>three ideas</em> for tonight.</>)}</h1>
              <p className="lede">{t("Fini le « on mange quoi ce soir ? ». Frigia repère ce qu'il y a dans ton frigo et te propose trois recettes avec ce que tu as déjà, pour toute la famille.", "No more \"what's for dinner?\". Frigia spots what's in your fridge and suggests three recipes with what you already have, for the whole family.")}</p>
              <div className="ctas"><button className="btn btn-fill" onClick={() => start("free", "hero")}>{WAITLIST ? JOIN : tryLabel()}</button><a className="link" href="#comment">{t("Voir comment ça marche", "See how it works")}</a></div>
              {WAITLIST && (
                <div className="wl-note">
                  <p>{t("Ouverture par petits groupes. Les premiers inscrits passent en premier.", "Opening in small groups. The first to sign up get in first.")}</p>
                  <button onClick={login}>{t("Déjà invité ? Se connecter", "Already invited? Log in")}</button>
                </div>
              )}
              <div className="reassure"><span className="chip plain">{t("Sans carte bancaire", "No card needed")}</span><span className="chip plain">{trialPitch()}</span><span className="chip plain">{t("Rien à télécharger", "Nothing to download")}</span></div>
            </div>
            <HeroArt />
          </div>
        </section>

        <HowItWorks />
        <Tonight onStart={source => start("free", source)} cta={WAITLIST ? JOIN : undefined} />
        <Explorer onStart={source => start("free", source)} cta={WAITLIST ? JOIN : tryLabel()} />

        <section className="plus rule" id="plus">
          <div className="container">
            <div className="sh"><span className="k">Frigia Plus</span><h2>{t(<>Pensé pour <em>toute la famille.</em></>, <>Made for <em>the whole family.</em></>)}</h2><p className="lede">{t("Tout est compris dès l'essai : le scan, et ce qui change la semaine d'un foyer, la famille, le planning, la liste de courses et ce que tu économises.", "Everything is included from the trial: the scan, and what changes a household's week, the family, the meal plan, the shopping list and what you save.")}</p></div>
            <div className="feats">
              <div className="feat"><div className="ill" aria-hidden="true"><span className="av">C</span><span className="av">T</span><span className="av">L</span><span className="av guest-av">+1</span></div><h3>{t(<>Mode <em>famille</em></>, <>Family <em>mode</em></>)}</h3><p>{t("Un profil par personne, enfants compris, avec allergies et « n'aime pas ». Les portions se calculent toutes seules.", "One profile per person, kids included, with allergies and dislikes. Portions are worked out for you.")}</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><div className="days">{t(["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"], ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).map((d, i) => <span key={d} className={[0, 1, 3, 4].includes(i) ? "p" : undefined}>{d}</span>)}</div></div><h3>{t(<>Ta <em>semaine</em></>, <>Your <em>week</em></>)}</h3><p>{t("À partir d'un scan, les repas de la semaine qui utilisent d'abord ce qui se périme vite. Les restes sont prévus.", "From one scan, the week's meals that use up what goes off fastest first. Leftovers are planned.")}</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><span className="chip">Parmesan</span><span className="chip">{t("Basilic", "Basil")}</span><span className="chip plain">+2</span></div><h3>{t(<>Liste de <em>courses</em></>, <>Shopping <em>list</em></>)}</h3><p>{t("Seulement ce qui manque, à cocher en magasin ou à envoyer par SMS ou WhatsApp.", "Only what's missing, to tick off in the shop or send by text or WhatsApp.")}</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><span className="chip plain">{t("Toutes", "All")}</span><span className="chip plain">{t("Moins de 20 min", "Under 20 min")}</span></div><h3>{t(<>Autres <em>idées</em></>, <>More <em>ideas</em></>)}</h3><p>{t("Trois nouvelles recettes sur le même scan, sans utiliser un nouveau scan.", "Three new recipes from the same scan, without using a new scan.")}</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><span className="badge">{t("Mardi soir", "Tuesday night")}</span><span className="chip">{t("Penne aux légumes", "Vegetable penne")}</span></div><h3>{t(<>Le plat <em>du jour</em></>, <>Today's <em>dish</em></>)}</h3><p>{t("Si un plat est prévu, il t'attend sur l'accueil. Tu coches qui mange et tu lances la cuisson.", "If a dish is planned, it's waiting on the home screen. You tick who's eating and start cooking.")}</p></div>
              <div className="feat"><div className="ill" aria-hidden="true"><span className="unit">€</span><span className="unit">kg</span></div><h3>{t(<>Ton <em>bilan</em></>, <>Your <em>report</em></>)}</h3><p>{t("Chaque mois, ce que tu as évité de jeter, en euros et en kilos. Scans illimités et tout l'historique.", "Every month, what you kept out of the bin, in euros and kilos. Unlimited scans and your full history.")}</p></div>
            </div>
          </div>
        </section>

        <section className="save rule">
          <div className="container grid">
            <div className="sh">
              <span className="k">{t("Moins de gaspi", "Less waste")}</span>
              <h2>{t(<>Ce que tu cuisines, <em>tu ne le jettes pas.</em></>, <>What you cook, <em>you don't throw away.</em></>)}</h2>
              <p className="lede">{t("Tu jettes environ 100 € de nourriture par an et par personne. Frigia t'aide à les garder : chaque recette part de ce qui est déjà dans ton frigo, en commençant par ce qui se périme.", "Each person throws away about €100 of food a year. Frigia helps you keep it: every recipe starts from what's already in your fridge, beginning with what goes off first.")}</p>
              <p className="source">{t("Source : ADEME.", "Source: ADEME (France).")}</p>
            </div>
            <div className="report">
              <div className="head"><span className="k">{t("Ton bilan · exemple", "Your report · example")}</span><span className="badge">Plus</span></div>
              <div><div className="big">{t("22,60 €", "€22.60")}</div><p className="muted">{t("sauvés ce mois-ci", "saved this month")}</p></div>
              <div className="tiles"><div><b>{t("−3,6 kg", "−3.6 kg")}</b><small>{t("de nourriture à la poubelle", "of food in the bin")}</small></div><div><b>6</b><small>{t("repas cuisinés avec ton frigo", "meals cooked from your fridge")}</small></div></div>
              <p className="source">{t("Exemple tiré de l'appli. Le tien se calcule avec tes vrais repas.", "Example from the app. Yours is worked out from your real meals.")}</p>
            </div>
          </div>
        </section>

        <section className="price rule" id="prix">
          <div className="container">
            <div className="sh"><span className="k">{WAITLIST ? t("Prix à l'ouverture", "Price at launch") : t("Prix", "Pricing")}</span><h2>{inAlpha() ? t(<>Gratuit jusqu'au 30 novembre, </>, <>Free until November 30, </>) : t(<>Essaie 7 jours, </>, <>Try it for 7 days, </>)}<em>{t("puis passe à Plus.", "then go Plus.")}</em></h2><p className="lede">{t("Pas de carte bancaire pour essayer, et rien n'est débité à la fin de l'essai. Plus est sans engagement.", "No card needed to try, and nothing is charged when the trial ends. Plus has no commitment.")}</p></div>
            <div className="offer">
              <div className="offer-main">
                <div className="top"><span className="k">Frigia Plus</span><span className="badge">{t("7 jours offerts", "7 days free")}</span></div>
                <div className="amount">{t("39,99 €", "€39.99")}<small>{t("par an", "per year")}</small></div>
                <div className="sub"><span>{t("Ou 6,99 € par mois", "Or €6.99 a month")}</span><span>{t("Résiliable en 3 clics", "Cancel in 3 taps")}</span></div>
                <div className="foot"><button className="btn btn-cream" onClick={() => start("free", "prix")}>{WAITLIST ? JOIN : tryLabel()}</button><span className="fine">{t("Sans engagement. Paiement sécurisé par Stripe.", "No commitment. Secure payment by Stripe.")}</span></div>
              </div>
              <ul aria-label={t("Compris dans Frigia Plus", "Included in Frigia Plus")}>{FEATURES.map(f => <li key={f}><span className="yes" aria-hidden="true">✓</span>{f}</li>)}</ul>
            </div>
          </div>
        </section>

        {canInstall && <InstallSection onInstall={install} />}

        <section className="faq rule" id="faq">
          <div className="container grid">
            <div className="sh"><span className="k">{t("Questions", "FAQ")}</span><h2>{t(<>Ce qu'on <em>nous demande.</em></>, <>What people <em>ask us.</em></>)}</h2></div>
            <div>
              {FAQ.map(f => (
                <details key={f.id}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                  {f.id === "appli" && canInstall && <a className="link" href="#installer">{t("Voir comment l'ajouter", "See how to add it")}</a>}
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <div className="big"><h2>{t(<>Ce soir, commence par <em>ouvrir le frigo.</em></>, <>Tonight, start by <em>opening the fridge.</em></>)}</h2><button className="btn btn-cream" onClick={() => start("free", "fin")}>{WAITLIST ? JOIN : tryLabel()}</button></div>
          <div className="base">
            <img src={`${IMG}/frigia-logo-inverse.svg`} alt="Frigia" width={78} height={28} />
            <nav className="legal" aria-label={t("Informations légales", "Legal information")}>
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
        <Turnstile ref={turnstile} siteKey={SITE_KEY} onSuccess={setCaptchaToken} onExpire={resetCaptcha} options={{ size: "invisible" }} />
      )}
    </div>
  );
}
