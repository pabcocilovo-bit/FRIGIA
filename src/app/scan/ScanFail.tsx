// Quand la photo ne passe pas : on le dit gentiment, le scan n'est pas décompté.
// Trois conseils, puis on reprend la photo, ou on tape ses ingrédients.
// Frigo vide : en Plus, des plats quand même (avec le placard et une petite liste de courses) ; en Gratuit, l'aperçu de Plus.
import { useNavigate } from "react-router";
import { Icon, LockPill, Pill } from "../../ui/components";
import { useOpenPaywall } from "../plus/subscription";
import { setScan, useScan } from "./store";
import "./scan.css";

const WHAT = { frigo: "ton frigo", placard: "ton placard", ticket: "ton ticket" };
const SEEN = { frigo: "ton frigo", placard: "un placard", ticket: "un ticket de caisse" };
const MODE = { frigo: "Frigo", placard: "Placard", ticket: "Ticket de caisse" };
const WHY = { floue: "La photo est un peu floue.", sombre: "La photo est un peu sombre.", vide: "On n'a pas trouvé d'aliment sur la photo." };

export function ScanFail({ isPlus }: { isPlus: boolean }) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const scan = useScan();
  const empty = scan.problem === "vide" && scan.source !== "ticket";
  const ideas = () => {
    if (!isPlus) { openPaywall("vide"); return; }
    setScan({ empty: true, ingredients: [], token: null, made: null });
    navigate("/scan/menu", { replace: true });
  };
  return (
    <section className="fa scan-screen scr-scanfail" aria-label="Scan raté">
      <div className="sf-top"><button type="button" className="fg-x" aria-label="Fermer" onClick={() => navigate("/")}><Icon name="x" /></button></div>
      <div className="scroll"><div className="sf-body">
        <div className="sf-art" aria-hidden="true">
          <span className="sf-ph">{scan.photo ? <img src={scan.photo} alt="" /> : null}<i className="sf-line" /></span>
          <span className="sf-c tl" /><span className="sf-c tr" /><span className="sf-c bl" /><span className="sf-c br" />
          <span className="sf-badge">?</span>
        </div>
        <h2>On n'a pas bien vu <em>{WHAT[scan.source]}</em></h2>
        <p>{WHY[scan.problem]} Pas de panique : <b>ce scan n'est pas décompté.</b></p>
        {/* Photo d'un placard prise en mode Frigo (ou l'inverse) : la caméra repart sur le bon mode */}
        {scan.switched && <p>On dirait {SEEN[scan.source]} : la caméra passe en mode {MODE[scan.source]}.</p>}
        <ul className="sf-tips">
          <li><span><Icon name="flash" /></span><div><b>Plus de lumière</b>Allume la cuisine ou le flash</div></li>
          <li><span><Icon name="cam" /></span><div><b>Recule d'un pas</b>Toutes les étagères dans le cadre</div></li>
          <li><span><Icon name="help" /></span><div><b>Porte grande ouverte</b>Et le téléphone bien droit</div></li>
        </ul>
        {/* Écart maquette : la carte « Frigo vide ? » n'existe pas dans le prototype, demandée par Hugo le 16 octobre */}
        {empty && (
          <button type="button" className="sf-empty" onClick={ideas}>
            <span className="ico"><Icon name="sparkle" /></span>
            <span className="tx"><b>Frigo vide ?</b>3 plats simples avec ce qui te reste, et une petite liste de courses</span>
            {isPlus ? <Icon name="next" className="muted" /> : <LockPill />}
          </button>
        )}
      </div></div>
      <div className="sf-foot">
        <Pill block icon="cam" onClick={() => navigate("/scan", { replace: true })}>Reprendre la photo</Pill>
        <button type="button" className="pill block sf-line-btn" onClick={() => navigate("/scan/ajouter", { state: { typed: true } })}>Taper mes ingrédients</button>
      </div>
    </section>
  );
}
