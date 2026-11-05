import { useState, type CSSProperties } from "react";
import { detectBrowser, openInNativeBrowser, type Browser } from "./browser";
import { isEn, t } from "../lib/i18n";

// ── Bandeau dans l'appli Google : on propose d'ouvrir Safari ou Chrome ─────────
export function GoogleInAppBar({ isIos, onDismiss }: { isIos: boolean; onDismiss: () => void }) {
  return (
    <div className="lp-gbar" role="region" aria-label={t("Ouvrir dans le navigateur", "Open in the browser")}>
      <span>{t(`Ouvre Frigia dans ${isIos ? "Safari" : "Chrome"} pour l'installer sur ton téléphone et créer ton compte.`, `Open Frigia in ${isIos ? "Safari" : "Chrome"} to install it on your phone and create your account.`)}</span>
      <button className="btn btn-cream" onClick={() => openInNativeBrowser(isIos)}>{t("Ouvrir", "Open")}</button>
      <button className="close" onClick={onDismiss} aria-label={t("Fermer", "Close")}>✕</button>
    </div>
  );
}

// « de Instagram » → « d'Instagram » devant une voyelle
const de = (nom: string) => (isEn ? nom : /^[aeiouàâéèêîïôû]/i.test(nom) ? `d'${nom}` : `de ${nom}`);

// ── Écran pour Instagram, TikTok, Facebook… : leur navigateur bloque l'inscription ──
export function SocialInAppScreen() {
  const ua = navigator.userAgent;
  const isTikTok = /BytedanceWebview|musical_ly|TikTok/i.test(ua);
  const isFacebook = /FBAN|FBAV|FB_IAB/i.test(ua);
  const app = /Instagram/i.test(ua) ? "Instagram" : isFacebook ? "Facebook" : isTikTok ? "TikTok" : /Snapchat/i.test(ua) ? "Snapchat" : t("cette appli", "this app");
  const menu = app === "Instagram" || isTikTok || isFacebook ? "···" : "⋮";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText("https://frigia.fr"); } catch { /* le lien reste affiché en dessous */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <main className="lp-inapp">
      <img className="logo" src="/landing/frigia-logo.svg" alt="Frigia" width={84} height={30} />
      <h1>{t(<>Ouvre Frigia <em>dans ton navigateur</em></>, <>Open Frigia <em>in your browser</em></>)}</h1>
      <p className="lede">{t(`Le navigateur ${de(app)} bloque la création de compte. Ça prend dix secondes :`, `The ${de(app)} browser blocks account creation. It takes ten seconds:`)}</p>
      <ol>{t(<>
        <li><span className="n">1</span><span>Appuie sur <b>{menu}</b> en haut à droite<small>dans {app}</small></span></li>
        <li><span className="n">2</span><span>Choisis <b>« Ouvrir dans le navigateur »</b><small>dans le menu qui s'affiche</small></span></li>
        <li><span className="n">3</span><span>Frigia s'ouvre dans <b>ton navigateur</b><small>tu peux créer ton compte normalement</small></span></li>
      </>, <>
        <li><span className="n">1</span><span>Tap <b>{menu}</b> at the top right<small>in {app}</small></span></li>
        <li><span className="n">2</span><span>Choose <b>"Open in browser"</b><small>in the menu that appears</small></span></li>
        <li><span className="n">3</span><span>Frigia opens in <b>your browser</b><small>you can create your account as usual</small></span></li>
      </>)}</ol>
      <button className="btn btn-fill" onClick={copy}>{copied ? t("Lien copié, colle-le dans ton navigateur", "Link copied, paste it in your browser") : t("Copier le lien frigia.fr", "Copy the frigia.fr link")}</button>
      <p className="muted">frigia.fr</p>
    </main>
  );
}

// ── Aide pour ajouter Frigia à l'écran d'accueil ──────────────────────────────
type Step = { label: string; strong: string; sub: string };
const STEPS_FR: Record<Browser, { steps: Step[]; arrow?: "top" | "bottom" }> = {
  "ios-safari": { arrow: "bottom", steps: [
    { label: "Appuie sur", strong: "···", sub: "Les 3 points en bas à droite de Safari" },
    { label: "Appuie sur", strong: "Partager", sub: "Dans le menu qui s'affiche" },
    { label: "Appuie sur", strong: "En voir plus", sub: "Pour voir toutes les options" },
    { label: "Appuie sur", strong: "Sur l'écran d'accueil", sub: "Dans la liste" },
    { label: "Appuie sur", strong: "Ajouter", sub: "En haut à droite, c'est tout" },
  ] },
  "ios-chrome": { arrow: "top", steps: [
    { label: "Appuie sur", strong: "le bouton Partager", sub: "L'icône □↑ en haut à droite de Chrome" },
    { label: "Appuie sur", strong: "En voir plus", sub: "Pour voir toutes les options" },
    { label: "Appuie sur", strong: "Sur l'écran d'accueil", sub: "Dans la liste" },
    { label: "Appuie sur", strong: "Ajouter", sub: "En haut à droite, c'est tout" },
  ] },
  "chrome-android": { steps: [
    { label: "Appuie sur", strong: "⋮", sub: "Les 3 points en haut à droite de Chrome" },
    { label: "Appuie sur", strong: "Ajouter à l'écran d'accueil", sub: "Ou « Installer l'application »" },
    { label: "Confirme avec", strong: "Ajouter", sub: "C'est tout" },
  ] },
  samsung: { steps: [
    { label: "Appuie sur", strong: "⋮", sub: "Les 3 points en bas à droite de Samsung Internet" },
    { label: "Appuie sur", strong: "Ajouter page à", sub: "Puis « Écran d'accueil »" },
    { label: "Confirme avec", strong: "Ajouter", sub: "C'est tout" },
  ] },
  "firefox-android": { steps: [
    { label: "Appuie sur", strong: "⋮", sub: "Le menu en bas à droite de Firefox" },
    { label: "Appuie sur", strong: "Installer", sub: "Ou « Ajouter à l'écran d'accueil »" },
    { label: "Confirme avec", strong: "Ajouter", sub: "C'est tout" },
  ] },
  "edge-mobile": { steps: [
    { label: "Appuie sur", strong: "···", sub: "Le menu en bas de Edge" },
    { label: "Appuie sur", strong: "Ajouter à l'écran d'accueil", sub: "Dans la liste des options" },
    { label: "Confirme avec", strong: "Ajouter", sub: "C'est tout" },
  ] },
  "chrome-desktop": { steps: [
    { label: "Clique sur", strong: "⊕", sub: "À droite de la barre d'adresse" },
    { label: "Clique sur", strong: "Installer Frigia", sub: "Dans la fenêtre qui s'ouvre, c'est tout" },
  ] },
  unknown: { steps: [
    { label: "Ouvre", strong: "le menu de ton navigateur", sub: "Le bouton ⋮ ou ···" },
    { label: "Cherche", strong: "Ajouter à l'écran d'accueil", sub: "Ou « Installer l'application »" },
    { label: "Confirme avec", strong: "Ajouter", sub: "C'est tout" },
  ] },
};

const STEPS_EN: Record<Browser, { steps: Step[]; arrow?: "top" | "bottom" }> = {
  "ios-safari": { arrow: "bottom", steps: [
    { label: "Tap", strong: "···", sub: "The 3 dots at the bottom right of Safari" },
    { label: "Tap", strong: "Share", sub: "In the menu that appears" },
    { label: "Tap", strong: "View More", sub: "To see all the options" },
    { label: "Tap", strong: "Add to Home Screen", sub: "In the list" },
    { label: "Tap", strong: "Add", sub: "At the top right, that's it" },
  ] },
  "ios-chrome": { arrow: "top", steps: [
    { label: "Tap", strong: "the Share button", sub: "The □↑ icon at the top right of Chrome" },
    { label: "Tap", strong: "View More", sub: "To see all the options" },
    { label: "Tap", strong: "Add to Home Screen", sub: "In the list" },
    { label: "Tap", strong: "Add", sub: "At the top right, that's it" },
  ] },
  "chrome-android": { steps: [
    { label: "Tap", strong: "⋮", sub: "The 3 dots at the top right of Chrome" },
    { label: "Tap", strong: "Add to Home screen", sub: "Or \"Install app\"" },
    { label: "Confirm with", strong: "Add", sub: "That's it" },
  ] },
  samsung: { steps: [
    { label: "Tap", strong: "⋮", sub: "The 3 dots at the bottom right of Samsung Internet" },
    { label: "Tap", strong: "Add page to", sub: "Then \"Home screen\"" },
    { label: "Confirm with", strong: "Add", sub: "That's it" },
  ] },
  "firefox-android": { steps: [
    { label: "Tap", strong: "⋮", sub: "The menu at the bottom right of Firefox" },
    { label: "Tap", strong: "Install", sub: "Or \"Add to Home screen\"" },
    { label: "Confirm with", strong: "Add", sub: "That's it" },
  ] },
  "edge-mobile": { steps: [
    { label: "Tap", strong: "···", sub: "The menu at the bottom of Edge" },
    { label: "Tap", strong: "Add to phone", sub: "In the list of options" },
    { label: "Confirm with", strong: "Add", sub: "That's it" },
  ] },
  "chrome-desktop": { steps: [
    { label: "Click", strong: "⊕", sub: "On the right of the address bar" },
    { label: "Click", strong: "Install Frigia", sub: "In the window that opens, that's it" },
  ] },
  unknown: { steps: [
    { label: "Open", strong: "your browser's menu", sub: "The ⋮ or ··· button" },
    { label: "Look for", strong: "Add to Home screen", sub: "Or \"Install app\"" },
    { label: "Confirm with", strong: "Add", sub: "That's it" },
  ] },
};
const STEPS = t(STEPS_FR, STEPS_EN);

export function InstallSheet({ onClose }: { onClose: () => void }) {
  const { steps, arrow } = STEPS[detectBrowser()];
  return (
    <div className="lp-install" onClick={onClose} style={{ "--card-bottom": arrow === "bottom" ? "90px" : "24px" } as CSSProperties}>
      {arrow && <div className="arrow" style={arrow === "top" ? { top: 16 } : { bottom: 16 }} aria-hidden="true">{arrow === "top" ? "↑" : "↓"}</div>}
      <div className="lp-sheet" role="dialog" aria-modal="true" aria-label={t("Ajouter Frigia à l'écran d'accueil", "Add Frigia to your home screen")} onClick={e => e.stopPropagation()}>
        <button className="lp-x" onClick={onClose} aria-label={t("Fermer", "Close")}>✕</button>
        <h2>{t(<>Frigia sur <em>ton écran d'accueil</em></>, <>Frigia on <em>your home screen</em></>)}</h2>
        <p className="intro">{t("Comme une appli, sans passer par un store.", "Like an app, without going through a store.")}</p>
        <ol>
          {steps.map((s, i) => (
            <li key={i}><span className="n">{i + 1}</span><span>{s.label} <b>{s.strong}</b><small>{s.sub}</small></span></li>
          ))}
        </ol>
      </div>
    </div>
  );
}
