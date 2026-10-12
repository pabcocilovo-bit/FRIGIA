// Ce qui entoure tous les écrans : l'écran d'ouverture, « Pas de réseau » et les petits messages.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Icon, Pill, Toast } from "../ui/components";
import { LOGO_SYMBOL, LOGO_WORD, SPLASH_SCENE } from "./logo";
import { isReallyOnline, useOfflineScreen } from "./offline";
import { showToast, useToastMessage } from "./toast";
import "./shell.css";

/** Écran d'ouverture : le logo et la petite scène, 2,5 secondes. Le toucher passe directement à l'accueil. */
function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <section className="fa splash play" aria-label="Ouverture de l'app" onClick={onDone}>
      <div className="sp-logo" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL + LOGO_WORD }} />
      <div className="sp-illu" dangerouslySetInnerHTML={{ __html: SPLASH_SCENE }} />
    </section>
  );
}

function Offline({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [no, setNo] = useState(0);
  const go = (path: string) => { onClose(); navigate(path); };
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    const [online] = await Promise.all([isReallyOnline(), new Promise(r => setTimeout(r, 1200))]);
    setBusy(false);
    if (online) {
      showToast("Te revoilà en ligne");
      setTimeout(onClose, 500);
    } else {
      setNo(n => n + 1);
      showToast("Toujours pas de réseau. Ta liste de courses reste dispo.");
    }
  };
  return (
    <section className="fa offline" aria-label="Pas de réseau">
      <div className="fg-top"><button type="button" className="fg-x" aria-label="Fermer" onClick={onClose}><Icon name="x" /></button></div>
      <div className="of-body">
        <div className="of-art" aria-hidden="true">
          <svg className="of-waves" viewBox="0 0 160 80"><path className="w3" d="M14 70a80 80 0 0 1 132 0" /><path className="w2" d="M38 72a52 52 0 0 1 84 0" /><path className="w1" d="M60 74a26 26 0 0 1 40 0" /></svg>
          <span className="fg-tile of-tile" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL }} />
          <span className="of-badge"><svg viewBox="0 0 24 24"><path d="M5 9.5a10 10 0 0 1 14 0M8 13a5.5 5.5 0 0 1 8 0" /><circle cx="12" cy="17" r="1.2" /><path d="M4 4l16 16" /></svg></span>
        </div>
        <h2>Pas de <em>réseau</em></h2>
        <p>Pour l'instant, ton téléphone n'arrive pas à se connecter. Vérifie le wifi ou les données mobiles.</p>
        <div className="of-card">
          <span className="label">Sans réseau, tu gardes</span>
          <button type="button" onClick={() => go("/courses")}><span><Icon name="cart" /></span><div><b>Ta liste de courses</b>Cochée au fil du magasin</div><Icon name="next" className="muted" /></button>
          <button type="button" onClick={() => go("/planning")}><span><Icon name="cal" /></span><div><b>Ta semaine</b>Midis et soirs prévus</div><Icon name="next" className="muted" /></button>
          <button type="button" onClick={() => go("/favoris")}><span><Icon name="heart" /></span><div><b>Tes favoris</b>Avec leurs étapes</div><Icon name="next" className="muted" /></button>
        </div>
        <p className="of-note">Seul le scan attend le retour du réseau.</p>
      </div>
      <div className="sf-foot">
        <Pill block icon="redo" key={no} className={["of-retry", busy && "busy", no > 0 && "no"].filter(Boolean).join(" ")} onClick={retry}>
          <span>{busy ? "Connexion…" : "Réessayer"}</span>
        </Pill>
      </div>
    </section>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  const [splash, setSplash] = useState(true);
  const endSplash = useCallback(() => setSplash(false), []);
  const [offline, closeOffline] = useOfflineScreen();
  const toast = useToastMessage();
  const { pathname } = useLocation();

  // Chaque écran s'ouvre en haut de page
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <>
      {children}
      {offline && <Offline onClose={closeOffline} />}
      {splash && <Splash onDone={endSplash} />}
      <div className="fa"><Toast message={toast} /></div>
    </>
  );
}
