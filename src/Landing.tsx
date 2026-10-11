import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import "./landing/landing.css";
import { AuthSheet, type AuthMode } from "./landing/AuthSheet";
import { LegalSheet, type LegalKey } from "./landing/legal";
import { GoogleInAppBar, InstallSheet, SocialInAppScreen } from "./landing/InApp";
import { InstallSection } from "./landing/InstallSection";
import { FAQ } from "./landing/faq";
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
const HERO_IDEAS = [
  ["pasta-legumes", "Penne aux légumes rôtis", "25 min · 6/8 dans ton frigo"],
  ["gratin-courgettes", "Gratin de courgettes", "35 min · 5/6 dans ton frigo"],
  ["omelette-tomates", "Omelette aux tomates", "15 min · 4/4 dans ton frigo"],
];

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
  { n: "Un.", img: "app-scan", alt: "L'écran de scan : le frigo dans le viseur, avec le choix ce midi, ce soir ou la semaine", t: "Tu prends ton frigo en photo.", p: "Pour ce midi, ce soir ou la semaine. Une photo de ta galerie marche aussi, pas besoin de ranger avant." },
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

// ── Prix : les mêmes lignes que l'écran « Passe à Plus » de l'appli ─────────
// true = inclus (coche), false = non inclus (tiret)
const PLAN_ROWS: [string, string | boolean, string | boolean][] = [
  ["Scans du frigo", "15 en tout", "Illimités"],
  ["Mode famille", false, true],
  ["Planning de la semaine", false, true],
  ["Liste de courses", false, true],
  ["Économies du mois", "Aperçu", "Complet"],
  ["Historique", "7 jours", "Tout"],
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <span className="yes" aria-label="Inclus">✓</span>;
  if (v === false) return <span className="no" aria-label="Non inclus">–</span>;
  return <span>{v}</span>;
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
            <HeroArt />
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
                <ul>{PLAN_ROWS.map(([label, free]) => <li key={label}><span>{label}</span><Cell v={free} /></li>)}</ul>
                <div className="foot"><button className="btn btn-line" onClick={() => start("free")}>Commencer gratuitement</button></div>
              </div>
              <div className="plan pro">
                <div className="top"><span className="k">Frigia Plus</span><span className="badge">Prix fondateur</span></div>
                <div className="amount">29,99 €<small>par an</small></div>
                <div className="sub"><span><s>39,99 €</s> pour les 500 premiers abonnés</span><span>Ou 6,99 € par mois</span></div>
                <ul>{PLAN_ROWS.map(([label, , plus]) => <li key={label}><span>{label}</span><Cell v={plus} /></li>)}</ul>
                <div className="foot"><button className="btn btn-cream" onClick={() => start("plus")}>Passer à Plus</button><span className="fine">Sans engagement. Paiement sécurisé par Stripe.</span></div>
              </div>
            </div>

            {/* Mobile : Gratuit et Plus côte à côte, comme l'écran « Passe à Plus » de l'appli */}
            <div className="compare">
              <table>
                <thead>
                  <tr>
                    <td></td>
                    <th scope="col"><span className="k">Gratuit</span><b>0 €</b><small>pour toujours</small></th>
                    <th scope="col" className="plus"><span className="badge">Prix fondateur</span><span className="k">Plus</span><b>29,99 €</b><small>par an</small></th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_ROWS.map(([label, free, plus]) => (
                    <tr key={label}><th scope="row">{label}</th><td><Cell v={free} /></td><td className="plus"><Cell v={plus} /></td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td></td>
                    <td><button className="btn btn-line" onClick={() => start("free")}>Commencer</button></td>
                    <td className="plus"><button className="btn btn-cream" onClick={() => start("plus")}>Passer à Plus</button></td>
                  </tr>
                </tfoot>
              </table>
              <p className="fine">Plus : 29,99 € par an pour les 500 premiers abonnés au lieu de <s>39,99 €</s>, ou 6,99 € par mois. Sans engagement, paiement sécurisé par Stripe.</p>
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
