// 16 · Activer les notifications (prototype V3) : après le premier repas cuisiné, depuis le centre ou les réglages.
// « Activer » ouvre la vraie fenêtre du téléphone (la maquette la dessine). Sur iPhone hors écran d'accueil, ou si le
// téléphone les a déjà bloquées, l'aide explique quoi faire.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { enablePush, isIOS, pushState, setNotifAsked, type PushState } from "../../lib/notify";
import { Icon } from "../../ui/components";
import { LOGO_SYMBOL } from "../logo";
import { useBack } from "../nav";
import { showToast } from "../toast";
import { t } from "../../lib/i18n";
import "./notifs.css";

const SPARK = "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z";

/** state.back : l'écran où revenir à la place du précédent (après la cuisson : l'accueil) */
export type NotifAskState = { back?: string };

export function NotifAsk() {
  const navigate = useNavigate();
  const back = useBack();
  const to = (useLocation().state as NotifAskState | null)?.back;
  const [ring, setRing] = useState(false);
  const busy = useRef(false);
  const [before, setBefore] = useState<PushState | null>(null);
  useEffect(() => { void pushState().then(setBefore); }, []);

  const leave = (msg?: string, delay = 250) => {
    setNotifAsked();
    setTimeout(() => {
      if (to) navigate(to, { replace: true }); else back();
      if (msg) showToast(msg);
    }, delay);
  };
  const help = (msg: string) => {
    setNotifAsked();
    navigate("/aide", { replace: !!to, state: { q: "notifs" } });
    showToast(msg);
  };

  const on = async () => {
    if (busy.current) return;
    if (before === "unsupported") return help(isIOS() ? t("Sur iPhone, ajoute d'abord Frigia à ton écran d'accueil", "On iPhone, first add Frigia to your home screen") : t("Ce navigateur ne reçoit pas les notifications", "This browser can't receive notifications"));
    if (before === "denied") return help(t("Elles sont bloquées dans les réglages du téléphone", "They're blocked in the phone's settings"));
    busy.current = true;
    const r = await enablePush();
    if (r === "on") { setRing(true); return leave(t("C'est noté : l'idée du soir arrive vers 18 h", "Done: tonight's idea arrives around 6 pm"), 900); }
    if (r === "error") { busy.current = false; return showToast(t("Ça n'a pas marché. Réessaie dans un moment", "That didn't work. Try again in a moment")); }
    leave(t("Pas de souci. Tu pourras les activer dans les réglages", "No problem. You can turn them on in settings"));
  };

  return (
    <section className={"fa scr-notif " + (ring ? "ring" : "on")} aria-label={t("Activer les notifications", "Turn on notifications")}>
      <div className="nf-top"><button type="button" className="fg-x" aria-label={t("Aide sur les notifications", "Help with notifications")} onClick={() => navigate("/aide", { state: { q: "notifs" } })}><Icon name="help" /></button></div>
      <div className="scroll"><div className="nf-body">
        <div className="nf-art" aria-hidden="true">
          <span className="nf-disc" />
          <svg className="nf-bell" viewBox="0 0 120 120" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <g className="nf-swing">
              <path d="M34 72c4-4 6-10 6-22a20 20 0 0 1 40 0c0 12 2 18 6 22z" fill="#F7F1E6" stroke="#24493A" strokeWidth="5" />
              <path d="M30 76h60" stroke="#24493A" strokeWidth="5" />
              <path d="M52 86a8 8 0 0 0 16 0" stroke="#24493A" strokeWidth="5" />
              <path d="M60 22v-6" stroke="#24493A" strokeWidth="5" />
              <path d="M48 44c1-5 4-8 8-9" stroke="#9FCCA4" strokeWidth="4" />
            </g>
          </svg>
          {["s1", "s2", "s3"].map(k => <svg key={k} className={"nf-spk " + k} viewBox="0 0 24 24"><path d={SPARK} /></svg>)}
          <div className="nf-push">
            <span className="fg-tile nf-tile" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL }} />
            <span className="nf-pt"><span><b>Frigia</b><i>18:00</i></span><small>{t("Ce soir : penne aux légumes. Tu as tout dans le frigo.", "Tonight: veggie penne. You have everything in the fridge.")}</small></span>
          </div>
        </div>
        <h2>{t(<>On te fait signe <em>au bon moment&nbsp;?</em></>, <>Shall we nudge you <em>at the right time?</em></>)}</h2>
        <p>{t(<>L'idée du soir vers 18&nbsp;h, avec ce qu'il te reste. Et le dimanche, un mot pour préparer ta semaine.</>, <>Tonight's idea around 6&nbsp;pm, with what you have left. And on Sundays, a note to plan your week.</>)}</p>
        <p className="nf-safe"><Icon name="shield" /><span>{t("Pas de pub. Tu choisis lesquelles dans les réglages.", "No ads. You choose which ones in settings.")}</span></p>
      </div></div>
      <div className="nf-foot">
        <button type="button" className="pill nf-on block" onClick={() => void on()}>{t("Activer (conseillé)", "Turn on (recommended)")}</button>
        <button type="button" className="nf-later" onClick={() => leave()}>{t("Plus tard", "Later")}</button>
      </div>
    </section>
  );
}
