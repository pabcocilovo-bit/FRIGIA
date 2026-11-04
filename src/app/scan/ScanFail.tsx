// Quand la photo ne passe pas : on le dit gentiment, le scan n'est pas décompté.
// Trois conseils, puis on reprend la photo, ou on tape ses ingrédients.
// Frigo vide : en Plus, des plats quand même (avec le placard et une petite liste de courses) ; en Gratuit, l'aperçu de Plus.
import { useNavigate } from "react-router";
import { Icon, LockPill, Pill } from "../../ui/components";
import { useOpenPaywall } from "../plus/subscription";
import { setScan, useScan } from "./store";
import { t } from "../../lib/i18n";
import "./scan.css";

const WHAT = t({ frigo: "ton frigo", placard: "ton placard", ticket: "ton ticket" }, { frigo: "your fridge", placard: "your cupboard", ticket: "your receipt" });
const SEEN = t({ frigo: "ton frigo", placard: "un placard", ticket: "un ticket de caisse" }, { frigo: "your fridge", placard: "a cupboard", ticket: "a receipt" });
const MODE = t({ frigo: "Frigo", placard: "Placard", ticket: "Ticket de caisse" }, { frigo: "Fridge", placard: "Cupboard", ticket: "Receipt" });
const WHY = t({ floue: "La photo est un peu floue.", sombre: "La photo est un peu sombre.", vide: "On n'a pas trouvé d'aliment sur la photo." },
  { floue: "The photo is a bit blurry.", sombre: "The photo is a bit dark.", vide: "We didn't find any food in the photo." });

export function ScanFail({ isPlus }: { isPlus: boolean }) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const scan = useScan();
  const empty = scan.problem === "vide" && scan.source !== "ticket";
  const ideas = () => {
    if (!isPlus) { openPaywall("vide"); return; }
    setScan({ empty: true, ingredients: [], token: null, off: [], made: null });
    navigate("/scan/menu", { replace: true });
  };
  return (
    <section className="fa scan-screen scr-scanfail" aria-label={t("Scan raté", "Scan failed")}>
      <div className="sf-top"><button type="button" className="fg-x" aria-label={t("Fermer", "Close")} onClick={() => navigate("/")}><Icon name="x" /></button></div>
      <div className="scroll"><div className="sf-body">
        <div className="sf-art" aria-hidden="true">
          <span className="sf-ph">{scan.photo ? <img src={scan.photo} alt="" /> : null}<i className="sf-line" /></span>
          <span className="sf-c tl" /><span className="sf-c tr" /><span className="sf-c bl" /><span className="sf-c br" />
          <span className="sf-badge">?</span>
        </div>
        <h2>{t("On n'a pas bien vu", "We couldn't quite see")} <em>{WHAT[scan.source]}</em></h2>
        <p>{WHY[scan.problem]} {t(<>Pas de panique : <b>ce scan n'est pas décompté.</b></>, <>Don't worry: <b>this scan doesn't count.</b></>)}</p>
        {/* Photo d'un placard prise en mode Frigo (ou l'inverse) : la caméra repart sur le bon mode */}
        {scan.switched && <p>{t(`On dirait ${SEEN[scan.source]} : la caméra passe en mode ${MODE[scan.source]}.`, `Looks like ${SEEN[scan.source]}: the camera switches to ${MODE[scan.source]} mode.`)}</p>}
        <ul className="sf-tips">
          <li><span><Icon name="flash" /></span><div><b>{t("Plus de lumière", "More light")}</b>{t("Allume la cuisine ou le flash", "Turn on the kitchen light or the flash")}</div></li>
          <li><span><Icon name="cam" /></span><div><b>{t("Recule d'un pas", "Step back")}</b>{t("Toutes les étagères dans le cadre", "All the shelves in the frame")}</div></li>
          <li><span><Icon name="help" /></span><div><b>{t("Porte grande ouverte", "Door wide open")}</b>{t("Et le téléphone bien droit", "And the phone held straight")}</div></li>
        </ul>
        {/* Écart maquette : la carte « Frigo vide ? » n'existe pas dans le prototype, demandée par Hugo le 16 octobre */}
        {empty && (
          <button type="button" className="sf-empty" onClick={ideas}>
            <span className="ico"><Icon name="sparkle" /></span>
            <span className="tx"><b>{t("Frigo vide ?", "Empty fridge?")}</b>{t("3 plats simples avec ce qui te reste, et une petite liste de courses", "3 simple dishes with what you have left, and a short shopping list")}</span>
            {isPlus ? <Icon name="next" className="muted" /> : <LockPill />}
          </button>
        )}
      </div></div>
      <div className="sf-foot">
        <Pill block icon="cam" onClick={() => navigate("/scan", { replace: true })}>{t("Reprendre la photo", "Retake the photo")}</Pill>
        <button type="button" className="pill block sf-line-btn" onClick={() => navigate("/scan/ajouter", { state: { typed: true } })}>{t("Taper mes ingrédients", "Type my ingredients")}</button>
      </div>
    </section>
  );
}
