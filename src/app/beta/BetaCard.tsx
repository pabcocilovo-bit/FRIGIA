// La carte « Ton avis compte » de l'accueil : à partir du 5e jour, après deux scans ou repas, jusqu'à la réponse.
// La croix (« Plus tard ») la cache deux jours ; après deux « Plus tard », elle ne revient plus (Mon profil garde « Donner mon avis »).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Icon } from "../../ui/components";
import type { User } from "../../lib/types";
import { answeredFeedback, shouldAskFeedback, snoozeFeedback } from "./survey";
import "./beta.css";

export function BetaCard({ user, uses }: { user: User | null; uses: number }) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const ask = !!user && shouldAskFeedback(user, uses);
  // La carte attend la base : déjà répondu sur un autre appareil, elle ne s'affiche pas
  const [checked, setChecked] = useState<string | null>(null);
  const uid = user?.id;
  useEffect(() => {
    if (!ask || !uid) return;
    let on = true;
    void answeredFeedback(uid).then(done => { if (on) { setHidden(done); setChecked(uid); } });
    return () => { on = false; };
  }, [ask, uid]);
  if (hidden || !user || !ask || checked !== user.id) return null;
  // Une seule ligne : l'accueil tient en un écran, la recette de la semaine rétrécit pour lui faire de la place
  return (
    <section className="av-card" aria-label="Ton avis compte">
      <button type="button" className="av-card-go" onClick={() => navigate("/avis?depuis=accueil")}>
        <span className="av-card-ic"><Icon name="msg" /></span>
        <span className="tx"><b>Ton avis compte</b><span>2 minutes pour nous aider</span></span>
        <Icon name="next" />
      </button>
      <button type="button" className="av-later" aria-label="Plus tard" onClick={() => { snoozeFeedback(user.id); setHidden(true); }}><Icon name="x" /></button>
    </section>
  );
}
