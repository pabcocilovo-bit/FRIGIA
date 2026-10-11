import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import "./landing/landing.css";
import { AuthSheet, type AuthMode } from "./landing/AuthSheet";
import { LegalSheet, type LegalKey } from "./landing/legal";
import { GoogleInAppBar, InstallSheet, SocialInAppScreen } from "./landing/InApp";
import { detectInAppBrowser, isStandalone, type InstallPromptEvent } from "./landing/browser";

// Landing V5 (refonte d'octobre 2026). Les textes décrivent les offres de la refonte :
// 15 scans offerts sans carte, puis Frigia Plus. À mettre en ligne en même temps que la nouvelle appli.
//
// onStart / onLogin : branchés par l'appli sur son parcours d'inscription quand il existera.
// Sans eux, la landing ouvre sa propre feuille de connexion (Supabase), comme l'ancienne version.
export type Plan = "free" | "plus";
type Props = { onStart?: (plan: Plan) => void; onLogin?: () => void };

const IMG = "/landing";
const CREAM = "#F5EFE3";

// ── Les 4 temps ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: "Un.", t: "Tu prends ton frigo en photo.", p: "Tu dis si c'est pour ce midi, ce soir ou la semaine. Une photo de ta galerie marche aussi, pas besoin de ranger avant." },
  { n: "Deux.", t: "Frigia liste ce qu'il voit.", p: "Les ingrédients s'affichent avec leurs quantités. Tu ajoutes un fond de placard ou retires ce qui ne va pas." },
  { n: "Trois.", t: "Tu dis qui mange.", p: "Chaque membre du foyer avec ses allergies et ce qu'il n'aime pas, plus un invité si besoin. Les quantités suivent." },
  { n: "Quatre.", t: "Tu choisis parmi trois recettes.", p: "Temps, étapes claires et ce qui est déjà dans ton frigo. Un appui, et le mode cuisine te guide pas à pas." },
];

function Board({ active }: { active: number }) {
  const layer = (i: number) => (i === active ? "layer on" : "layer");
  return (
    <div className="board" aria-hidden="true">
      <div className={layer(0)}>
        <div className="panel">
          <span className="k">Scan du frigo</span>
          <div className="scan"><img src={`${IMG}/frigia-symbole-inverse.svg`} alt="" width={120} height={120} /><i></i><i></i><i></i><i></i></div>
          <div className="seg"><span>Ce midi</span><span className="sel">Ce soir</span><span>La semaine</span></div>
        </div>
      </div>
      <div className={layer(1)}>
        <div className="panel">
          <span className="k">8 ingrédients · scan de 18 h 42</span>
          <h3>Ce qu'il y a <em>dans ton frigo</em></h3>
          {[["Tomates cerises", "250 g"], ["Courgettes", "2"], ["Poivrons", "3"], ["Œufs", "6"], ["Penne", "500 g"]].map(([n, q]) => (
            <div className="row" key={n}><span>{n}</span><span>{q}</span></div>
          ))}
          <div className="row add"><span>+ Ajouter un ingrédient</span><span></span></div>
        </div>
      </div>
      <div className={layer(2)}>
        <div className="panel">
          <span className="k">Qui mange ce soir ?</span>
          <div className="who">
            <div><i>C</i>Camille</div><div><i>T</i>Thomas</div><div><i>L</i>Léo<small>9 ans</small></div><div className="off"><i>J</i>Jade<small>5 ans</small></div>
          </div>
          <div className="guest"><span>Des invités ?</span><b>+1</b></div>
          <div className="row"><span>Allergies</span><span>Arachide · Léo</span></div>
          <div className="row"><span>Équipement</span><span>Four · Airfryer</span></div>
        </div>
      </div>
      <div className={layer(3)}>
        <div className="panel">
          <span className="k">Pour 4 personnes</span>
          <h3>Trois idées <em>pour ce soir</em></h3>
          {[["pasta-legumes", "Penne aux légumes rôtis", "25 min · 6/8 dans ton frigo"], ["gratin-courgettes", "Gratin de courgettes", "35 min · 5/6 dans ton frigo"], ["omelette-tomates", "Omelette aux tomates", "15 min · 4/4 dans ton frigo"]].map(([img, name, meta]) => (
            <div className="rec" key={img}><img src={`${IMG}/${img}.jpg`} alt="" width={56} height={56} loading="lazy" /><div><b>{name}</b><small>{meta}</small></div></div>
          ))}
          <div className="go"><span>Lancer la cuisson · 25 min</span><i>→</i></div>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const [active, setActive] = useState(0);
  const sticky = useRef<HTMLDivElement>(null);
  const steps = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width:900px)");
    let frame = 0;
    const pick = () => {
      frame = 0;
      // Ordinateur : l'étape dont le titre a passé le milieu de l'écran.
      // Mobile : le visuel occupe le haut, on prend l'étape qui atteint le milieu de l'espace libre en dessous.
      const boardBottom = sticky.current?.getBoundingClientRect().bottom ?? 0;
      const line = mq.matches ? boardBottom + (window.innerHeight - boardBottom) * 0.5 : window.innerHeight * 0.55;
      let i = 0;
      steps.current.forEach((s, k) => { const h = s?.querySelector("h3"); if (h && h.getBoundingClientRect().top < line) i = k; });
      setActive(i);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(pick); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <section className="how rule" id="comment">
      <div className="container">
        <div className="sh"><span className="k">Comment ça marche</span><h2>Du frigo à l'assiette, <em>en quatre temps.</em></h2><p className="lede">Pas de liste de quinze ingrédients ni de recette à chercher. Tu montres ce que tu as, Frigia s'occupe du reste.</p></div>
        <div className="grid">
          <div className="sticky" ref={sticky}><Board active={active} /></div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="step" key={s.n} ref={el => { steps.current[i] = el; }}>
                <span className="num">{s.n}</span><h3>{s.t}</h3><p>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Essai : avec ce frigo-là, on mange quoi ? ────────────────────────────────
type Envie = "rapide" | "enfants" | "gaspi" | "vege";
const ENVIES: [Envie, string][] = [["rapide", "Rapide"], ["enfants", "Les enfants adorent"], ["gaspi", "Anti-gaspi"], ["vege", "Végé"]];
const PEOPLE = ["2", "3", "4", "5"];
const PHOTO = { omelette: "omelette-tomates", gratin: "gratin-courgettes", pates: "pasta-legumes", salade: "salade-caprese", soupe: "soupe-detox", wrap: "wrap-proteine" };
// [photo, nom, minutes, ingrédients du frigo utilisés / total]
const IDEAS: Record<Envie, [keyof typeof PHOTO, string, number, string][]> = {
  rapide: [["omelette", "Omelette tomates et poivrons", 15, "5/6"], ["wrap", "Wraps œufs et crudités", 15, "5/7"], ["salade", "Salade tomates-mozzarella", 10, "3/5"]],
  enfants: [["pates", "Penne aux légumes rôtis", 25, "6/8"], ["gratin", "Gratin de courgettes", 35, "5/6"], ["wrap", "Wraps croustillants maison", 20, "5/7"]],
  gaspi: [["soupe", "Soupe verte courgette-brocoli", 25, "5/5"], ["pates", "Pâtes du fond du frigo", 20, "7/8"], ["omelette", "Omelette aux restes de légumes", 15, "6/6"]],
  vege: [["gratin", "Gratin de courgettes", 35, "5/6"], ["soupe", "Soupe verte courgette-brocoli", 25, "5/5"], ["salade", "Salade tomates-mozzarella", 10, "3/5"]],
};

function Tonight({ onStart }: { onStart: () => void }) {
  const [envie, setEnvie] = useState<Envie>("rapide");
  const [pers, setPers] = useState("4");
  return (
    <section className="tonight" id="essai">
      <div className="container">
        <div className="sh"><span className="k">Essaie, ici</span><h2>Avec ce frigo-là, <em>on mange quoi ?</em></h2><p className="lede">Choisis une envie et le nombre de personnes. Voici le genre d'idées que Frigia te proposerait avec les 8 ingrédients du scan.</p></div>
        <form className="controls" onSubmit={e => e.preventDefault()}>
          <fieldset>
            <legend>Ce soir, plutôt</legend>
            <div className="opts">
              {ENVIES.map(([v, label]) => (
                <label key={v}><input type="radio" name="envie" value={v} checked={envie === v} onChange={() => setEnvie(v)} /><span>{label}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Pour combien</legend>
            <div className="opts">
              {PEOPLE.map(p => (
                <label key={p}><input type="radio" name="pers" value={p} checked={pers === p} onChange={() => setPers(p)} aria-label={`${p} personnes`} /><span>{p}</span></label>
              ))}
            </div>
          </fieldset>
        </form>
        <div className="cards" aria-live="polite">
          {IDEAS[envie].map(([img, name, min, used], i) => (
            <article className="card" key={envie + i}>
              <div className="img"><img src={`${IMG}/${PHOTO[img]}.jpg`} alt="" width={560} height={373} loading="lazy" /></div>
              <div className="body">
                <span className="k">Idée {i + 1} sur 3</span>
                <h3>{name}</h3>
                <div className="meta"><span>{min} min</span><span>Pour {pers}</span><span className="in">{used} dans ton frigo</span></div>
              </div>
            </article>
          ))}
        </div>
        <div className="end"><span className="note">Exemple. Avec ton frigo, les idées seront les tiennes.</span><button className="btn btn-cream" onClick={onStart}>Essayer avec mon frigo</button></div>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Landing({ onStart, onLogin }: Props) {
  const { isGoogleApp, isSocialApp, isIos, isAndroid } = detectInAppBrowser();
  const [auth, setAuth] = useState<AuthMode | null>(null);
  const [legal, setLegal] = useState<LegalKey | null>(null);
  const [installHint, setInstallHint] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [gbarClosed, setGbarClosed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileInstance>(null);
  const resetCaptcha = () => { turnstile.current?.reset(); setCaptchaToken(null); };

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

  const start = (plan: Plan = "free") => (onStart ? onStart(plan) : setAuth("signup"));
  const login = () => (onLogin ? onLogin() : setAuth("login"));
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
    <div className="lp" style={showGbar ? { paddingTop: 64 } : undefined}>
      {showGbar && <GoogleInAppBar isIos={isIos} onDismiss={() => setGbarClosed(true)} />}

      <div className="promo">Gratuit, sans carte bancaire · 15 scans offerts · <b>Prix fondateur</b> pour les 500 premiers abonnés Plus</div>
      <header className="nav">
        <div className="container">
          <a className="home" href="#top" aria-label="Frigia, accueil"><img src={`${IMG}/frigia-logo.svg`} alt="Frigia" width={84} height={30} /></a>
          <nav className="links" aria-label="Navigation"><a href="#comment">Comment ça marche</a><a href="#plus">Frigia Plus</a><a href="#prix">Prix</a><a href="#faq">Questions</a></nav>
          <div className="right">
            <button className="login-short" onClick={login}>Connexion</button>
            <button className="btn btn-line" onClick={login}>J'ai déjà un compte</button>
            <button className="btn btn-fill" onClick={() => start()}>Commencer</button>
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
              <div className="ctas"><button className="btn btn-fill" onClick={() => start()}>Commencer gratuitement</button><a className="link" href="#comment">Voir comment ça marche</a></div>
              <div className="reassure"><span className="chip plain">Sans carte bancaire</span><span className="chip plain">15 scans offerts</span><span className="chip plain">Rien à télécharger</span></div>
            </div>
            <div className="scene">
              <div className="found">
                <span className="k">8 ingrédients repérés</span>
                <div className="chips">{["Tomates", "Courgettes", "Poivrons", "Œufs", "Penne"].map(c => <span className="chip" key={c}>{c}</span>)}</div>
                <div className="rec"><img src={`${IMG}/pasta-legumes.jpg`} alt="" width={56} height={56} /><div><b>Penne aux légumes rôtis</b><small>25 min · pour 4 · 6/8 dans ton frigo</small></div><i aria-hidden="true">→</i></div>
              </div>
              <img className="ill" src={`${IMG}/illustration.svg`} alt="Une maman prend son frigo en photo avec son téléphone, son fils tient une carotte" width={390} height={330} />
            </div>
          </div>
        </section>

        <HowItWorks />
        <Tonight onStart={() => start()} />

        <section className="plus" id="plus">
          <div className="container">
            <div className="sh"><span className="k">Frigia Plus</span><h2>Pensé pour <em>toute la famille.</em></h2><p className="lede">Le scan reste gratuit pour commencer. Plus ajoute ce qui change la semaine d'un foyer : la famille, le planning, la liste de courses et ce que tu économises.</p></div>
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
            <div className="sh"><span className="k">Prix</span><h2>Commence gratuitement, <em>passe à Plus</em> quand tu veux.</h2><p className="lede">Pas de carte bancaire pour essayer. Plus est sans engagement, et un code créateur se saisit à l'inscription.</p></div>
            <div className="plans">
              <div className="plan">
                <div className="top"><span className="k">Gratuit</span></div>
                <div className="amount">0 €</div>
                <div className="sub"><span>Sans carte bancaire</span><span>Pour toujours</span></div>
                <ul>
                  <li><span>Scans du frigo</span><span>15 en tout</span></li>
                  <li><span>Recettes par scan</span><span>3</span></li>
                  <li><span>Mode famille, semaine, liste de courses</span><span aria-label="Non inclus">–</span></li>
                  <li><span>Autres idées sur un même scan</span><span aria-label="Non inclus">–</span></li>
                  <li><span>Économies du mois</span><span>Aperçu</span></li>
                  <li><span>Historique</span><span>7 jours</span></li>
                </ul>
                <div className="foot"><button className="btn btn-line" onClick={() => start("free")}>Commencer gratuitement</button></div>
              </div>
              <div className="plan pro">
                <div className="top"><span className="k">Frigia Plus</span><span className="badge">Prix fondateur</span></div>
                <div className="amount">29,99 €<small>par an</small></div>
                <div className="sub"><span><s>39,99 €</s> pour les 500 premiers abonnés</span><span>Ou 6,99 € par mois</span></div>
                <ul>
                  <li><span>Scans du frigo</span><span>Illimités</span></li>
                  <li><span>Recettes par scan</span><span>3</span></li>
                  <li><span>Mode famille, semaine, liste de courses</span><span>Inclus</span></li>
                  <li><span>Autres idées sur un même scan</span><span>Inclus</span></li>
                  <li><span>Économies du mois</span><span>Complet</span></li>
                  <li><span>Historique</span><span>Tout</span></li>
                </ul>
                <div className="foot"><button className="btn btn-cream" onClick={() => start("plus")}>Passer à Plus</button><span className="fine">Sans engagement. Paiement sécurisé par Stripe.</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="faq rule" id="faq">
          <div className="container grid">
            <div className="sh"><span className="k">Questions</span><h2>Ce qu'on <em>nous demande.</em></h2></div>
            <div>
              <details><summary>Faut-il une carte bancaire pour essayer ?</summary><p>Non. La formule Gratuit se crée avec ton email ou ton compte Google, sans carte. Tu as 15 scans pour essayer.</p></details>
              <details><summary>Et quand j'ai utilisé mes 15 scans ?</summary><p>Tu peux passer à Plus pour des scans illimités. Tes recettes et tes favoris restent là.</p></details>
              <details>
                <summary>Faut-il télécharger une appli ?</summary>
                <p>Non. Frigia s'ouvre dans ton navigateur et s'ajoute à l'écran d'accueil de ton téléphone, comme une appli.</p>
                {canInstall && <button className="link" onClick={install}>L'ajouter à mon écran d'accueil</button>}
              </details>
              <details><summary>Ça marche avec des enfants et des allergies ?</summary><p>Oui. Avec Plus, chaque membre du foyer a son profil : âge, allergies et ce qu'il n'aime pas. Les recettes en tiennent compte.</p></details>
              <details><summary>Je peux arrêter Plus quand je veux ?</summary><p>Oui, c'est sans engagement. Tu résilies depuis tes réglages, en quelques gestes.</p></details>
              <details><summary>J'ai un code créateur, je le mets où ?</summary><p>À l'inscription, avant de choisir Google ou l'email. Tu peux aussi le saisir en passant à Plus.</p></details>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <div className="big"><h2>Ce soir, commence par <em>ouvrir le frigo.</em></h2><button className="btn btn-cream" onClick={() => start()}>Commencer gratuitement</button></div>
          <div className="base">
            <img src={`${IMG}/frigia-logo-inverse.svg`} alt="Frigia" width={78} height={28} />
            <nav className="legal" aria-label="Informations légales">
              <button onClick={() => setLegal("mentions")}>Mentions légales</button>
              <button onClick={() => setLegal("cgu")}>Conditions</button>
              <button onClick={() => setLegal("confidentialite")}>Confidentialité</button>
              <button onClick={() => setLegal("cookies")}>Cookies</button>
              <a href="mailto:frigia.contact@gmail.com">Contact</a>
            </nav>
          </div>
        </div>
      </footer>

      {auth && <AuthSheet initialMode={auth} captchaToken={captchaToken} onResetCaptcha={resetCaptcha} onLegal={setLegal} onClose={() => setAuth(null)} />}
      {legal && <LegalSheet initial={legal} onClose={() => setLegal(null)} />}
      {installHint && <InstallSheet onClose={() => setInstallHint(false)} />}
      {internalAuth && (
        <Turnstile ref={turnstile} siteKey="0x4AAAAAADcyx1Wtay8saMMq" onSuccess={setCaptchaToken} onExpire={resetCaptcha} options={{ size: "invisible" }} />
      )}
    </div>
  );
}
