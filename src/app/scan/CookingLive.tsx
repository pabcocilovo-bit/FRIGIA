// Sur tous les écrans de l'appli (demandé par Hugo le 23 octobre, « comme quand on attend une commande Uber Eats ») :
// la bulle de la recette en cours, avec son minuteur, et « Minuteur terminé » quand il arrive à zéro.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Dialog, Icon, Pill, TextLink } from "../../ui/components";
import { showToast } from "../toast";
import { t } from "../../lib/i18n";
import { closeRing, fireTimer, getCooking, mmss, oneMore, setCooking, timeLeft, useCooking, useNow, useRing } from "./cooking";

/** Pas de bulle sur ces écrans : ils prennent tout l'écran (caméra, paiement) */
const NO_BUBBLE = ["/scan", "/plus"];

export function CookingLive() {
  const c = useCooking();
  const ring = useRing();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tm = c?.timer ?? null;
  const running = tm?.end != null;
  const now = useNow(running, 500);

  // Le minuteur arrive à zéro, sur n'importe quel écran. Appli rouverte après la fin : il sonne en revenant.
  useEffect(() => {
    if (!running) return;
    const check = () => { const end = getCooking()?.timer?.end; if (end != null && Date.now() >= end) fireTimer(); };
    check();
    const id = setInterval(check, 500);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", check); };
  }, [running, tm?.end]);

  const open = (path: string, state: unknown) => navigate(path, { state });
  const bubble = c && pathname !== c.path && !NO_BUBBLE.some(p => pathname === p || pathname.startsWith(p + "/"));
  const left = tm ? timeLeft(tm, now) : 0;
  const late = ring ? Math.floor((now - ring.end) / 60000) : 0;

  return (
    <>
      {bubble && (
        <div className="fa ck-live-wrap">
          <div className={"ck-live" + (running ? " run" : "")} role="status">
            <button type="button" className="go" onClick={() => open(c.path, c.state)}>
              <span className="ico"><Icon name={tm ? "clock" : "pan"} /></span>
              <span className="txt">
                <b>{tm ? <>{tm.label} · <span className="tn">{running ? mmss(left) : t("en pause", "paused")}</span></> : t("Recette en cours", "Recipe in progress")}</b>
                <small>{c.title} · {t(`étape ${c.step + 1} sur ${c.steps}`, `step ${c.step + 1} of ${c.steps}`)}</small>
              </span>
            </button>
            <button type="button" className="x" aria-label={t("Arrêter la recette", "Stop the recipe")} onClick={() => { setCooking(null); showToast(t("Recette arrêtée", "Recipe stopped")); }}><Icon name="x" /></button>
            {tm && <i className="bar" style={{ width: `${Math.min(100, 100 - (left / tm.seconds) * 100)}%` }} />}
          </div>
        </div>
      )}
      <Dialog open={!!ring} onClose={closeRing} icon="clock" className="ck-ring" label={t("Minuteur terminé", "Timer done")}
        title={t(<>Minuteur <em>terminé</em></>, <>Timer <em>done</em></>)}>
        {ring && <p><b>{ring.timer.label}</b>{late > 0 && t(` · il y a ${late} min`, ` · ${late} min ago`)}<br />{ring.title}</p>}
        <Pill block onClick={closeRing}>{t("C'est bon", "Got it")}</Pill>
        <div className="ck-ring-more">
          <TextLink onClick={oneMore}>{t("Encore 1 min", "1 more min")}</TextLink>
          {ring && pathname !== ring.path && <TextLink onClick={() => { closeRing(); open(ring.path, ring.state); }}>{t("Voir la recette", "See the recipe")}</TextLink>}
        </div>
      </Dialog>
    </>
  );
}
