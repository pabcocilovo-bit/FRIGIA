// Quand la photo ne passe pas : on le dit gentiment, le scan n'est pas décompté.
// Trois conseils, puis on reprend la photo, ou on tape ses ingrédients.
import { useNavigate } from "react-router";
import { Icon, Pill } from "../../ui/components";
import { useScan } from "./store";
import "./scan.css";

const WHAT = { frigo: "ton frigo", placard: "ton placard", ticket: "ton ticket" };
const WHY = { floue: "La photo est un peu floue.", sombre: "La photo est un peu sombre.", vide: "On n'a pas trouvé d'aliment sur la photo." };

export function ScanFail() {
  const navigate = useNavigate();
  const scan = useScan();
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
        <ul className="sf-tips">
          <li><span><Icon name="flash" /></span><div><b>Plus de lumière</b>Allume la cuisine ou le flash</div></li>
          <li><span><Icon name="cam" /></span><div><b>Recule d'un pas</b>Toutes les étagères dans le cadre</div></li>
          <li><span><Icon name="help" /></span><div><b>Porte grande ouverte</b>Et le téléphone bien droit</div></li>
        </ul>
      </div></div>
      <div className="sf-foot">
        <Pill block icon="cam" onClick={() => navigate("/scan", { replace: true })}>Reprendre la photo</Pill>
        <button type="button" className="pill block sf-line-btn" onClick={() => navigate("/scan/ajouter", { state: { typed: true } })}>Taper mes ingrédients</button>
      </div>
    </section>
  );
}
