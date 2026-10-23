// Sur tous les écrans de l'appli (demandé par Hugo le 23 octobre, « comme quand on attend une commande Uber Eats ») :
// la bulle de la recette en cours, avec son minuteur, et « Minuteur terminé » quand il arrive à zéro.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Dialog, Icon, Pill, TextLink } from "../../ui/components";
import { showToast } from "../toast";
import { closeRing, fireTimer, getCooking, mmss, oneMore, setCooking, timeLeft, useCooking, useNow, useRing } from "./cooking";

/** Pas de bulle sur ces écrans : ils prennent tout l'écran (caméra, paiement) */
const NO_BUBBLE = ["/scan", "/plus"];

export function CookingLive() {
  const c = useCooking();
  const ring = useRing();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const t = c?.timer ?? null;
  const running = t?.end != null;
  const now = useNow(running, 500);

  // Le minuteur arrive à zéro, sur n'importe quel écran. Appli rouverte après la fin : il sonne en revenant.
  useEffect(() => {
    if (!running) return;
    const check = () => { const end = getCooking()?.timer?.end; if (end != null && Date.now() >= end) fireTimer(); };
    check();
    const id = setInterval(check, 500);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", check); };
  }, [running, t?.end]);

  const open = (path: string, state: unknown) => navigate(path, { state });
  const bubble = c && pathname !== c.path && !NO_BUBBLE.some(p => pathname === p || pathname.startsWith(p + "/"));
  const left = t ? timeLeft(t, now) : 0;
  const late = ring ? Math.floor((now - ring.end) / 60000) : 0;

  return (
    <>
      {bubble && (
        <div className="fa ck-live-wrap">
          <div className={"ck-live" + (running ? " run" : "")} role="status">
            <button type="button" className="go" onClick={() => open(c.path, c.state)}>
              <span className="ico"><Icon name={t ? "clock" : "pan"} /></span>
              <span className="txt">
                <b>{t ? <>{t.label} · <span className="tn">{running ? mmss(left) : "en pause"}</span></> : "Recette en cours"}</b>
                <small>{c.title} · étape {c.step + 1} sur {c.steps}</small>
              </span>
            </button>
            <button type="button" className="x" aria-label="Arrêter la recette" onClick={() => { setCooking(null); showToast("Recette arrêtée"); }}><Icon name="x" /></button>
            {t && <i className="bar" style={{ width: `${Math.min(100, 100 - (left / t.seconds) * 100)}%` }} />}
          </div>
        </div>
      )}
      <Dialog open={!!ring} onClose={closeRing} icon="clock" className="ck-ring" label="Minuteur terminé"
        title={<>Minuteur <em>terminé</em></>}>
        {ring && <p><b>{ring.timer.label}</b>{late > 0 && ` · il y a ${late} min`}<br />{ring.title}</p>}
        <Pill block onClick={closeRing}>C'est bon</Pill>
        <div className="ck-ring-more">
          <TextLink onClick={oneMore}>Encore 1 min</TextLink>
          {ring && pathname !== ring.path && <TextLink onClick={() => { closeRing(); open(ring.path, ring.state); }}>Voir la recette</TextLink>}
        </div>
      </Dialog>
    </>
  );
}
