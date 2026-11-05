import { useState, type ReactNode } from "react";
import { isAndroid } from "./browser";
import { t } from "../lib/i18n";

// Section « Frigia sur ton écran d'accueil », dans l'esprit des tutos en 3 cartes (Pangram).
// Le bouton ouvre l'installation de Chrome quand elle existe, sinon le pas-à-pas adapté au navigateur (InstallSheet).
type OS = "ios" | "android";
const IMG = "/landing";

const Tap = () => <span className="tap" aria-hidden="true" />;

// ── Les maquettes d'écran, en HTML pour rester nettes et légères ─────────────
function IosShare() {
  return (
    <div className="mock">
      <div className="page"><img src={`${IMG}/frigia-logo.svg`} alt="" width={70} height={25} /><i /><i /><i className="short" /></div>
      <div className="pop">
        <span>{t("Copier", "Copy")}</span>
        <span className="hl">{t("Partager", "Share")}<b>↑</b><Tap /></span>
        <span>{t("Ajouter aux favoris", "Add Bookmark")}</span>
      </div>
      <div className="bar bottom"><span className="url">frigia.fr</span><span className="dots on">···</span></div>
    </div>
  );
}
function AndroidMenu() {
  return (
    <div className="mock">
      <div className="bar top"><span className="url">frigia.fr</span><span className="dots on">⋮<Tap /></span></div>
      <div className="page"><img src={`${IMG}/frigia-logo.svg`} alt="" width={70} height={25} /><i /><i /><i className="short" /></div>
    </div>
  );
}
function IosSheet() {
  return (
    <div className="mock sheet">
      <div className="who"><img src={`${IMG}/frigia-icone.png`} alt="" width={36} height={36} /><span><b>Frigia</b><small>frigia.fr</small></span></div>
      <div className="apps"><i /><i /><i /><i /></div>
      <span>{t("Copier", "Copy")}</span>
      <span>{t("Ajouter à la liste de lecture", "Add to Reading List")}</span>
      <span className="hl">{t("Sur l'écran d'accueil", "Add to Home Screen")}<b>⊞</b><Tap /></span>
    </div>
  );
}
function AndroidList() {
  return (
    <div className="mock sheet">
      <span>{t("Nouvel onglet", "New tab")}</span>
      <span>{t("Historique", "History")}</span>
      <span>{t("Partager…", "Share…")}</span>
      <span className="hl">{t("Ajouter à l'écran d'accueil", "Add to Home screen")}<Tap /></span>
      <span>{t("Paramètres", "Settings")}</span>
    </div>
  );
}
function HomeScreen() {
  return (
    <div className="mock home">
      {Array.from({ length: 7 }, (_, i) => <span key={i} className="app"><i /><small /></span>)}
      <span className="app frigia"><img src={`${IMG}/frigia-icone.png`} alt="" width={52} height={52} /><small>Frigia</small></span>
    </div>
  );
}

const STEPS: Record<OS, { bg: string; mock: ReactNode; t: string; p: string }[]> = t<Record<OS, { bg: string; mock: ReactNode; t: string; p: string }[]>>({
  ios: [
    { bg: "salade-caprese", mock: <IosShare />, t: "Ouvre Partager.", p: "Dans Safari, touche ··· en bas à droite, puis Partager." },
    { bg: "soupe-detox", mock: <IosSheet />, t: "Sur l'écran d'accueil.", p: "Fais défiler la liste. Si tu ne le vois pas, touche « En voir plus »." },
    { bg: "pasta-legumes", mock: <HomeScreen />, t: "C'est prêt.", p: "Touche Ajouter. Frigia s'ouvre en plein écran, comme une appli." },
  ],
  android: [
    { bg: "salade-caprese", mock: <AndroidMenu />, t: "Ouvre le menu.", p: "Dans Chrome, touche ⋮ en haut à droite de l'écran." },
    { bg: "soupe-detox", mock: <AndroidList />, t: "Ajoute à l'écran d'accueil.", p: "Parfois écrit « Installer l'application »." },
    { bg: "pasta-legumes", mock: <HomeScreen />, t: "C'est prêt.", p: "Touche Installer. Frigia s'ouvre en plein écran, comme une appli." },
  ],
}, {
  ios: [
    { bg: "salade-caprese", mock: <IosShare />, t: "Open Share.", p: "In Safari, tap ··· at the bottom right, then Share." },
    { bg: "soupe-detox", mock: <IosSheet />, t: "Add to Home Screen.", p: "Scroll down the list. If you don't see it, tap \"View More\"." },
    { bg: "pasta-legumes", mock: <HomeScreen />, t: "You're done.", p: "Tap Add. Frigia opens full screen, like an app." },
  ],
  android: [
    { bg: "salade-caprese", mock: <AndroidMenu />, t: "Open the menu.", p: "In Chrome, tap ⋮ at the top right of the screen." },
    { bg: "soupe-detox", mock: <AndroidList />, t: "Add to Home screen.", p: "Sometimes called \"Install app\"." },
    { bg: "pasta-legumes", mock: <HomeScreen />, t: "You're done.", p: "Tap Install. Frigia opens full screen, like an app." },
  ],
});

export function InstallSection({ onInstall }: { onInstall: () => void }) {
  const [os, setOs] = useState<OS>(() => (isAndroid() ? "android" : "ios"));
  return (
    <section className="install" id="installer">
      <div className="container">
        <div className="ihead">
          <div className="sh">
            <span className="k">{t("Comme une appli", "Just like an app")}</span>
            <h2>{t(<>Frigia sur ton écran, <em>en trois gestes.</em></>, <>Frigia on your screen, <em>in three taps.</em></>)}</h2>
            <p className="lede">{t("Pas de store, rien à télécharger. Ajoute Frigia à ton écran d'accueil : il s'ouvre en plein écran, comme une appli.", "No store, nothing to download. Add Frigia to your home screen: it opens full screen, like an app.")}</p>
          </div>
          <div className="icta">
            <button className="btn btn-cream" onClick={onInstall}>{t("Ajouter Frigia à l'accueil", "Add Frigia to your home screen")}</button>
            <small>{t("On te montre les étapes pour ton téléphone.", "We'll show you the steps for your phone.")}</small>
          </div>
        </div>
        <div className="os-switch" role="group" aria-label={t("Ton téléphone", "Your phone")}>
          <button aria-pressed={os === "ios"} onClick={() => setOs("ios")}>iPhone</button>
          <button aria-pressed={os === "android"} onClick={() => setOs("android")}>Android</button>
        </div>
        <ol className="itrio">
          {STEPS[os].map((s, i) => (
            <li className="icard" key={os + i}>
              <div className="ivis" aria-hidden="true">
                <img className="ibg" src={`${IMG}/${s.bg}.jpg`} alt="" width={560} height={373} loading="lazy" />
                {s.mock}
              </div>
              <div className="itxt"><span className="num">{t(["Un.", "Deux.", "Trois."], ["One.", "Two.", "Three."])[i]}</span><h3>{s.t}</h3><p>{s.p}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
