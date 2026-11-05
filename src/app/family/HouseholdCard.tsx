// La carte « Ton foyer » de l'accueil, pour les comptes d'avant la question 4 de l'inscription (Hugo, 5 novembre) :
// sans proche, elle propose d'ajouter son foyer ; avec un foyer dont personne n'a réglé son appétit, elle le fait découvrir.
// La croix la cache pour de bon (sur ce téléphone) ; elle disparaît aussi d'elle-même une fois le foyer ou un appétit réglé.
import { useState } from "react";
import { useNavigate } from "react-router";
import { Icon } from "../../ui/components";
import type { Person } from "../../lib/household";
import { t } from "../../lib/i18n";
import "../beta/beta.css";

const KEY = (userId: string) => `frigia_foyer_card_${userId}`;
const seen = (userId: string) => { try { return !!localStorage.getItem(KEY(userId)); } catch { return false; } };

export function HouseholdCard({ userId, household }: { userId: string; household: Person[] }) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => seen(userId));
  const alone = !household.some(p => !p.me);
  const appetiteSet = household.some(p => p.appetite != null);
  if (hidden || (!alone && appetiteSet)) return null;
  const close = () => { try { localStorage.setItem(KEY(userId), "1"); } catch { /* navigation privée */ } setHidden(true); };
  const [title, sub] = alone
    ? [t("Qui mange avec toi ?", "Who eats with you?"), t("Ajoute ton foyer : portions, allergies et appétit de chacun", "Add your household: servings, allergies and everyone's appetite")]
    : [t("L'appétit de chacun", "Everyone's appetite"), t("Petit appétit ou gros mangeur : les portions suivent", "Small appetite or big eater: servings follow")];
  return (
    <section className="av-card" aria-label={title}>
      <button type="button" className="av-card-go" onClick={() => navigate("/famille/foyer")}>
        <span className="av-card-ic"><Icon name="users" /></span>
        <span className="tx"><b>{title}</b><span>{sub}</span></span>
        <Icon name="next" />
      </button>
      <button type="button" className="av-later" aria-label={t("Masquer", "Hide")} onClick={close}><Icon name="x" /></button>
    </section>
  );
}
