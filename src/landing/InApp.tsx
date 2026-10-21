import { useState, type CSSProperties } from "react";
import { detectBrowser, openInNativeBrowser, type Browser } from "./browser";

// ── Bandeau dans l'appli Google : on propose d'ouvrir Safari ou Chrome ─────────
export function GoogleInAppBar({ isIos, onDismiss }: { isIos: boolean; onDismiss: () => void }) {
  return (
    <div className="lp-gbar" role="region" aria-label="Ouvrir dans le navigateur">
      <span>Ouvre Frigia dans {isIos ? "Safari" : "Chrome"}, c'est plus simple pour créer ton compte.</span>
      <button className="btn btn-cream" onClick={() => openInNativeBrowser(isIos)}>Ouvrir</button>
      <button className="close" onClick={onDismiss} aria-label="Fermer">✕</button>
    </div>
  );
}

// « de Instagram » → « d'Instagram » devant une voyelle
const de = (nom: string) => (/^[aeiouàâéèêîïôû]/i.test(nom) ? `d'${nom}` : `de ${nom}`);

// ── Écran pour Instagram, TikTok, Facebook… : leur navigateur bloque l'inscription ──
export function SocialInAppScreen() {
  const ua = navigator.userAgent;
  const isTikTok = /BytedanceWebview|musical_ly|TikTok/i.test(ua);
  const isFacebook = /FBAN|FBAV|FB_IAB/i.test(ua);
  const app = /Instagram/i.test(ua) ? "Instagram" : isFacebook ? "Facebook" : isTikTok ? "TikTok" : /Snapchat/i.test(ua) ? "Snapchat" : "cette appli";
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
      <h1>Ouvre Frigia <em>dans ton navigateur</em></h1>
      <p className="lede">Le navigateur {de(app)} bloque la création de compte. Ça prend dix secondes :</p>
      <ol>
        <li><span className="n">1</span><span>Appuie sur <b>{menu}</b> en haut à droite<small>dans {app}</small></span></li>
        <li><span className="n">2</span><span>Choisis <b>« Ouvrir dans le navigateur »</b><small>dans le menu qui s'affiche</small></span></li>
        <li><span className="n">3</span><span>Frigia s'ouvre dans <b>ton navigateur</b><small>tu peux créer ton compte normalement</small></span></li>
      </ol>
      <button className="btn btn-fill" onClick={copy}>{copied ? "Lien copié, colle-le dans ton navigateur" : "Copier le lien frigia.fr"}</button>
      <p className="muted">frigia.fr</p>
    </main>
  );
}

// ── Aide pour ajouter Frigia à l'écran d'accueil ──────────────────────────────
type Step = { label: string; strong: string; sub: string };
const STEPS: Record<Browser, { steps: Step[]; arrow?: "top" | "bottom" }> = {
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

export function InstallSheet({ onClose }: { onClose: () => void }) {
  const { steps, arrow } = STEPS[detectBrowser()];
  return (
    <div className="lp-install" onClick={onClose} style={{ "--card-bottom": arrow === "bottom" ? "90px" : "24px" } as CSSProperties}>
      {arrow && <div className="arrow" style={arrow === "top" ? { top: 16 } : { bottom: 16 }} aria-hidden="true">{arrow === "top" ? "↑" : "↓"}</div>}
      <div className="lp-sheet" role="dialog" aria-modal="true" aria-label="Ajouter Frigia à l'écran d'accueil" onClick={e => e.stopPropagation()}>
        <button className="lp-x" onClick={onClose} aria-label="Fermer">✕</button>
        <h2>Frigia sur <em>ton écran d'accueil</em></h2>
        <p className="intro">Comme une appli, sans passer par un store.</p>
        <ol>
          {steps.map((s, i) => (
            <li key={i}><span className="n">{i + 1}</span><span>{s.label} <b>{s.strong}</b><small>{s.sub}</small></span></li>
          ))}
        </ol>
      </div>
    </div>
  );
}
