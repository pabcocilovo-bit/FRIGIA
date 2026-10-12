// 10 · Famille (prototype V3) : le compte, le foyer, les goûts, le parrainage et l'abonnement.
import { useNavigate } from "react-router";
import { Icon, Pill, RoundButton } from "../ui/components";
import type { Prefs, User } from "../lib/types";
import { AppTabBar } from "./AppTabBar";
import { Avatar } from "./Home";
import { firstName, initial, memberSince, tasteRows } from "./format";
import { comingSoon } from "./toast";

export function Family({ user, isPlus, avatar, prefs, onManageSubscription }: {
  user: User; isPlus: boolean; avatar: string | null; prefs: Prefs | null; onManageSubscription: () => void;
}) {
  const navigate = useNavigate();
  const tastes = prefs && tasteRows(prefs);
  const name = firstName(user);

  return (
    <div className="fa fa-app" aria-label="Ta famille">
      <div className="phead">
        <div className="row">
          <span className="label">Ta famille</span>
          <RoundButton icon="gear" label="Réglages" tone="glass" onClick={() => navigate("/reglages")} />
        </div>
        <div className="pid">
          <div className="pav">
            <Avatar user={user} photo={avatar} className="plate pav-av" label="Ta photo de profil" />
            <button type="button" className="pedit" aria-label="Changer ta photo de profil" onClick={() => navigate("/reglages")}><Icon name="cam" /></button>
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
              <span className="ini">{initial(user)}</span>
              <span className="tx"><b>{name}</b><span>Adulte · aime tout</span></span>
              <Icon name="next" />
            </button>
          </div>
        ) : (
          <div className="famcta">
            <span className="avs"><span className="ini">C</span><span className="ini">T</span><span className="ini k">L</span><span className="ini k">J</span></span>
            <b>Ajoute ta famille</b>
            <p>L'âge, les allergies et ce que chacun n'aime pas. Les portions se calculent toutes seules.</p>
            <Pill onClick={() => comingSoon(5)}>Découvrir Plus</Pill>
          </div>
        )}

        <div className="sec"><h3>Tes goûts</h3><button type="button" className="link" onClick={() => comingSoon(4)}>Modifier</button></div>
        <p className="pintro">Enregistrés sur ton compte : tu les retrouves sur tous tes appareils.</p>
        {tastes && (
          <div className="plist">
            {([["salad", "Régime", tastes.diet], ["pan", "Ustensiles", tastes.equipment], ["clock", "Temps en semaine", tastes.time]] as const)
              .filter(([, , value]) => value)
              .map(([icon, title, value]) => (
                <button key={title} type="button" className="prow" onClick={() => comingSoon(4)}>
                  <span className="pi"><Icon name={icon} /></span><span className="tx"><b>{title}</b><span>{value}</span></span><Icon name="next" />
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
            <div><b>Frigia Plus</b></div>
            <button type="button" className="pill" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} onClick={onManageSubscription}>Gérer</button>
          </div>
        ) : (
          <div className="subcard free-sub">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>Formule Gratuit</b><span>15 scans offerts, sans carte bancaire</span></div>
            <Pill onClick={() => comingSoon(5)}>Plus</Pill>
          </div>
        )}

        <div className="plist quiet">
          <button type="button" className="prow" onClick={() => navigate("/reglages")}>
            <span className="pi"><Icon name="gear" /></span><span className="tx"><b>Réglages et aide</b><span>Notifications, langue, compte</span></span><Icon name="next" />
          </button>
        </div>
      </div>
      <AppTabBar active="family" isPlus={isPlus} />
    </div>
  );
}
