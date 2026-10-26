// La carte « Ton avis compte » de l'accueil : à partir du 5e jour, après deux scans ou repas, jusqu'à la réponse.
// « Plus tard » la cache deux jours ; après deux « Plus tard », elle ne revient plus (Mon profil garde « Donner mon avis »).
import { useState } from "react";
import { useNavigate } from "react-router";
import { Icon, Pill } from "../../ui/components";
import type { User } from "../../lib/types";
import { shouldAskFeedback, snoozeFeedback } from "./survey";
import "./beta.css";

export function BetaCard({ user, uses }: { user: User | null; uses: number }) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  if (hidden || !user || !shouldAskFeedback(user, uses)) return null;
  return (
    <section className="av-card" aria-label="Ton avis compte">
      <div className="av-card-hd">
        <span className="av-card-ic"><Icon name="msg" /></span>
        <span className="tx"><b>Ton avis compte</b><span>Tu testes Frigia en avant-première. Dis-nous en 2 minutes ce qui marche et ce qui coince.</span></span>
      </div>
      <div className="av-card-ft">
        <Pill onClick={() => navigate("/avis?depuis=accueil")}>Donner mon avis</Pill>
        <button type="button" className="av-later" onClick={() => { snoozeFeedback(user.id); setHidden(true); }}>Plus tard</button>
      </div>
    </section>
  );
}
