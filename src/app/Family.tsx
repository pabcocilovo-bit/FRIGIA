// 10 · Famille (prototype V3) : le compte, le foyer, les goûts, le parrainage et l'abonnement.
import { useState } from "react";
import { useNavigate } from "react-router";
import { Icon, Pill, RoundButton } from "../ui/components";
import type { User } from "../lib/types";
import type { Profile } from "../lib/profile";
import { AppTabBar } from "./AppTabBar";
import { Avatar } from "./Home";
import { memberSince, tasteRows } from "./format";
import { comingSoon } from "./toast";
import { subscriptionText, useOpenPaywall, useSubscription } from "./plus/subscription";
import { AccountSheet, type AccountMode, type Dish } from "./settings/sheets";

export function Family({ user, name, isPlus, avatar, profile, dishes, onAvatar, onName, onEditTastes }: {
  user: User; name: string; isPlus: boolean; avatar: string | null; profile: Profile | null;
  /** La photo de profil (le crayon sur la photo) : changée ici, comme dans Ton compte */
  dishes: Dish[]; onAvatar: (src: string | null) => void; onName: (name: string) => void;
  /** Sans question : les 3 questions (« Modifier ») ; 2 ou 3 : cette question seule (une ligne de « Tes goûts ») */
  onEditTastes: (question?: 2 | 3) => void;
}) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  // L'abonnement Stripe (prix, prochaine date) ; null pour un compte Plus sans abonnement (accès offert)
  const { sub } = useSubscription(user.id, isPlus);
  const tastes = profile && tasteRows(profile);
  const [sheet, setSheet] = useState<AccountMode | null>(null);

  return (
    <div className="fa fa-app" aria-label="Ta famille">
      <div className="phead no-stats">
        <div className="row">
          <span className="label">Ta famille</span>
          <RoundButton icon="gear" label="Réglages" tone="glass" onClick={() => navigate("/reglages")} />
        </div>
        <div className="pid">
          <div className="pav">
            <Avatar user={user} name={name} photo={avatar} className="plate pav-av" label="Ta photo de profil" />
            <button type="button" className="pedit" aria-label="Changer ta photo de profil" onClick={() => setSheet("photo")}><Icon name="cam" /></button>
          </div>
          <h2>{name}</h2>
          <p>{memberSince(user)}</p>
          {isPlus
            ? <span className="plus-tag"><Icon name="sparkle" />Frigia Plus</span>
            : <span className="plus-tag" style={{ background: "rgba(247,241,230,.18)", color: "var(--on)" }}>Formule Gratuit</span>}
        </div>
      </div>

      <div className="pbody">
        <div className="sec"><h3>Ton foyer</h3>{isPlus && <button type="button" className="link" onClick={() => comingSoon(10)}>Ajouter</button>}</div>
        {isPlus ? (
          <div className="plist">
            <button type="button" className="prow" onClick={() => comingSoon(10)}>
              <span className={"ini" + (avatar ? " has-pp" : "")} style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{name.charAt(0).toUpperCase()}</span>
              <span className="tx"><b>{name}</b><span>Adulte · aime tout</span></span>
              <Icon name="next" />
            </button>
          </div>
        ) : (
          <div className="famcta">
            <span className="avs"><span className="ini">C</span><span className="ini">T</span><span className="ini k">L</span><span className="ini k">J</span></span>
            <b>Ajoute ta famille</b>
            <p>L'âge, les allergies et ce que chacun n'aime pas. Les portions se calculent toutes seules.</p>
            <Pill onClick={() => openPaywall("famille")}>Découvrir Plus</Pill>
          </div>
        )}

        <div className="sec"><h3>Tes goûts</h3><button type="button" className="link" onClick={() => onEditTastes()}>Modifier</button></div>
        <p className="pintro">Enregistrés sur ton compte : tu les retrouves sur tous tes appareils.</p>
        {tastes && (
          <div className="plist">
            {/* Les 3 lignes restent, même vides : la maquette n'a pas d'état vide, on invite à compléter */}
            {([["salad", "Régime", tastes.diet, 2, ""], ["pan", "Ustensiles", tastes.equipment, 3, "Ajoute ton matériel"], ["clock", "Temps en semaine", tastes.time, 3, "Indique ton temps"]] as const)
              .map(([icon, title, value, question, empty]) => (
                <button key={title} type="button" className="prow" onClick={() => onEditTastes(question)}>
                  <span className="pi"><Icon name={icon} /></span><span className="tx"><b>{title}</b>{value ? <span>{value}</span> : <span className="add">{empty}</span>}</span><Icon name="next" />
                </button>
              ))}
          </div>
        )}

        <div className="sec"><h3>Parrainage</h3></div>
        <div className="refer">
          <span className="pi"><Icon name="gift" /></span>
          <div><b>1 mois offert par ami abonné</b><span>Et 10 scans en plus pour ton ami</span></div>
          <button type="button" className="pill" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} onClick={() => comingSoon(11)}>Inviter</button>
        </div>

        <div className="sec"><h3>Ton abonnement</h3></div>
        {isPlus ? (
          <div className="subcard">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>Frigia Plus</b>{sub && <span>{subscriptionText(sub)}</span>}</div>
            {sub !== null && <button type="button" className="pill" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} onClick={() => navigate("/resilier")}>Gérer</button>}
          </div>
        ) : (
          <div className="subcard free-sub">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>Formule Gratuit</b><span>15 scans offerts, sans carte bancaire</span></div>
            <Pill onClick={() => openPaywall("def")}>Plus</Pill>
          </div>
        )}

        <div className="plist quiet">
          <button type="button" className="prow" onClick={() => navigate("/reglages")}>
            <span className="pi"><Icon name="gear" /></span><span className="tx"><b>Réglages et aide</b><span>Notifications, langue, compte</span></span><Icon name="next" />
          </button>
        </div>
      </div>
      <AppTabBar active="family" isPlus={isPlus} />
      <AccountSheet mode={sheet} onClose={() => setSheet(null)} onMode={setSheet} user={user} name={name} avatar={avatar} dishes={dishes} onAvatar={onAvatar} onName={onName} />
    </div>
  );
}
