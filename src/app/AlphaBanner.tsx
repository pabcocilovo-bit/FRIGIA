// Le bandeau de l'alpha (Hugo, 3 novembre), en haut de l'accueil : gratuit jusqu'au 30 novembre, et « Nous écrire » pour un bug
// ou une idée. Fermé d'un appui, il ne revient pas sur ce téléphone. Disparaît tout seul à la fin de l'alpha.
import { useState } from "react";
import { useNavigate } from "react-router";
import { Icon } from "../ui/components";
import { inAlpha } from "../lib/alpha";

const SEEN = "frigia_alpha_ferme";
const closed = () => { try { return localStorage.getItem(SEEN) === "1"; } catch { return false; } };

export function AlphaBanner() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(closed);
  if (hidden || !inAlpha()) return null;
  const close = () => {
    try { localStorage.setItem(SEEN, "1"); } catch { /* navigation privée */ }
    setHidden(true);
  };
  return (
    <aside className="hm-alpha" aria-label="Version alpha">
      <span className="hm-alpha-tag">Alpha</span>
      <p><b>Frigia est en alpha.</b> Tout est gratuit jusqu'au 30 novembre. Un bug, une idée ?{" "}
        <button type="button" onClick={() => navigate("/aide", { state: { send: "contact" } })}>Écris-nous</button></p>
      <button type="button" className="hm-alpha-x" aria-label="Fermer" onClick={close}><Icon name="x" /></button>
    </aside>
  );
}
