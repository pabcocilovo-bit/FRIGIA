// 10 · Mon profil. V3 (maquette de Hugo, 25 octobre) : plus d'onglet Famille, on arrive ici par « Mon profil », en haut de l'accueil.
// Une page menu : ta photo et ton nom, le parrainage, puis Mon foyer, Mes préférences, Budget courses, Mon abonnement,
// Compte et sécurité, Réglages, Aide et contact, Se déconnecter. Le foyer, les goûts et l'abonnement ont chacun leur page (ci-dessous).
import { useState } from "react";
import { useNavigate } from "react-router";
import { Icon, type IconName, Pill } from "../ui/components";
import type { User } from "../lib/types";
import type { Profile } from "../lib/profile";
import { memberSub, type Person } from "../lib/household";
import { AppTabBar } from "./AppTabBar";
import { GreenHead } from "./GreenHead";
import { Avatar } from "./Home";
import { memberSince, tasteRows } from "./format";
import { subscriptionText, useOpenPaywall, useSubscription } from "./plus/subscription";
import { trialText, trialUntil } from "../lib/billing";
import { AccountSheet, type AccountMode, type Dish } from "./settings/sheets";

function MenuRow({ icon, title, sub, onClick, lock }: { icon: IconName; title: string; sub: string; onClick: () => void; lock?: boolean }) {
  return (
    <button type="button" className="mp-row" onClick={onClick}>
      <Icon name={icon} />
      <span className="tx"><b>{title}</b><span>{sub}</span></span>
      {lock ? <span className="lockpill">Plus</span> : <Icon name="next" />}
    </button>
  );
}

export function Family({ user, name, isPlus, avatar, dishes, onAvatar, onName, onSignOut }: {
  user: User; name: string; isPlus: boolean; avatar: string | null;
  /** La photo de profil (l'appareil photo sur la photo) : changée ici, comme dans Ton compte */
  dishes: Dish[]; onAvatar: (src: string | null) => void; onName: (name: string) => void;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  // En essai : les jours qui restent
  const [trial] = useState(() => trialUntil(user));
  const [sheet, setSheet] = useState<AccountMode | null>(null);

  return (
    <div className="fa fa-app" aria-label="Mon profil">
      <GreenHead title="Mon profil">
        <div className="mp-me">
          <div className="pav">
            <Avatar user={user} name={name} photo={avatar} className="plate pav-av mp-av" label="Ta photo de profil" />
            <button type="button" className="pedit" aria-label="Changer ta photo de profil" onClick={() => setSheet("photo")}><Icon name="cam" /></button>
          </div>
          <button type="button" className="mp-id" onClick={() => navigate("/reglages/compte")}>
            <span className="tx">
              <b>{name}</b>
              <span>{memberSince(user)}</span>
              {isPlus && !trial
                ? <span className="plus-tag"><Icon name="sparkle" />Frigia Plus</span>
                : <span className="plus-tag">{trial ? "Essai de Frigia Plus" : "Sans abonnement"}</span>}
            </span>
            <Icon name="next" />
          </button>
        </div>
      </GreenHead>

      <div className="v3-body mp-body">
        <button type="button" className="sp-hi mp-refer" onClick={() => navigate("/parrainage")}>
          <Icon name="gift" />
          <span className="tx"><b>Invite tes amis, gagne du Plus&nbsp;!</b><span>1 mois de Frigia Plus offert par ami abonné.</span></span>
          <Icon name="next" />
        </button>

        <div className="mp-card">
          <MenuRow icon="users" title="Mon foyer" sub="Membres et profils alimentaires" onClick={() => navigate("/famille/foyer")} />
          <MenuRow icon="salad" title="Mes préférences" sub="Régime, ustensiles et temps disponible" onClick={() => navigate("/famille/preferences")} />
          <MenuRow icon="cart" title="Budget courses" sub="Dépenses et budget mensuel" lock={!isPlus}
            onClick={() => (isPlus ? navigate("/famille/budget") : openPaywall("budget", "/famille/budget"))} />
          <MenuRow icon="crown" title="Mon abonnement" sub={trial ? trialText(trial) : "Frigia Plus et facturation"} onClick={() => navigate("/famille/abonnement")} />
        </div>

        <div className="mp-card">
          <MenuRow icon="user" title="Compte et sécurité" sub="Informations personnelles, connexion" onClick={() => navigate("/reglages/compte")} />
          <MenuRow icon="gear" title="Réglages de l'application" sub="Notifications, apparence, infos légales" onClick={() => navigate("/reglages")} />
          <MenuRow icon="help" title="Aide et contact" sub="Questions fréquentes, nous écrire" onClick={() => navigate("/aide")} />
        </div>

        <button type="button" className="mp-out" onClick={onSignOut}>
          <Icon name="logout" /><b>Se déconnecter</b><Icon name="next" />
        </button>
      </div>
      <AppTabBar isPlus={isPlus} />
      <AccountSheet mode={sheet} onClose={() => setSheet(null)} onMode={setSheet} user={user} name={name} avatar={avatar} dishes={dishes} onAvatar={onAvatar} onName={onName} />
    </div>
  );
}

/** Mon foyer : toi et tes proches (Plus). Essai fini : ce que Plus apporte. */
export function FamilyHousehold({ isPlus, avatar, household }: { isPlus: boolean; avatar: string | null; household: Person[] }) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  return (
    <div className="fa fa-app" aria-label="Mon foyer">
      <GreenHead title="Mon foyer" sub="Membres et profils alimentaires" />
      <div className="v3-body pbody">
        {isPlus ? <>
          <div className="plist">
            {household.map(p => {
              const sub = memberSub(p), pp = p.me && avatar;
              return (
                <button key={p.id} type="button" className="prow" onClick={() => navigate(`/famille/proche/${p.id}`)}>
                  <span className={"ini" + (p.kid ? " k" : "") + (pp ? " has-pp" : "")} style={pp ? { backgroundImage: `url(${avatar})` } : undefined}>{p.name.charAt(0).toUpperCase()}</span>
                  <span className="tx"><b>{p.name}{p.kid ? `, ${p.age} ans` : ""}</b><span className={sub.alert ? "add" : undefined}>{sub.text}</span></span>
                  <Icon name="next" />
                </button>
              );
            })}
          </div>
          <Pill icon="plus" block onClick={() => navigate("/famille/proche")}>Ajouter un proche</Pill>
        </> : (
          <div className="famcta">
            <span className="avs"><span className="ini">C</span><span className="ini">T</span><span className="ini k">L</span><span className="ini k">J</span></span>
            <b>Ajoute ta famille</b>
            <p>L'âge, les allergies et ce que chacun n'aime pas. Les portions se calculent toutes seules.</p>
            <Pill onClick={() => openPaywall("famille")}>Découvrir Plus</Pill>
          </div>
        )}
      </div>
      <AppTabBar isPlus={isPlus} />
    </div>
  );
}

/** Mes préférences : régime, ustensiles et temps en semaine. Une ligne rouvre sa question. */
export function FamilyTastes({ isPlus, profile, onEditTastes }: {
  isPlus: boolean; profile: Profile | null;
  /** Sans question : les 3 questions (« Tout modifier ») ; 2 ou 3 : cette question seule */
  onEditTastes: (question?: 2 | 3) => void;
}) {
  const tastes = profile && tasteRows(profile);
  return (
    <div className="fa fa-app" aria-label="Mes préférences">
      <GreenHead title="Mes préférences" sub="Enregistrées sur ton compte, sur tous tes appareils" />
      <div className="v3-body pbody">
        {tastes && (
          <div className="plist">
            {/* Les 3 lignes restent, même vides : on invite à compléter */}
            {([["salad", "Régime", tastes.diet, 2, ""], ["pan", "Ustensiles", tastes.equipment, 3, "Ajoute ton matériel"], ["clock", "Temps en semaine", tastes.time, 3, "Indique ton temps"]] as const)
              .map(([icon, title, value, question, empty]) => (
                <button key={title} type="button" className="prow" onClick={() => onEditTastes(question)}>
                  <span className="pi"><Icon name={icon} /></span><span className="tx"><b>{title}</b>{value ? <span>{value}</span> : <span className="add">{empty}</span>}</span><Icon name="next" />
                </button>
              ))}
          </div>
        )}
        <Pill tone="cream" block onClick={() => onEditTastes()}>Tout modifier</Pill>
      </div>
      <AppTabBar isPlus={isPlus} />
    </div>
  );
}

/** Mon abonnement : l'essai, Plus (gérer, résilier) ou sans abonnement. */
export function FamilySubscription({ user, isPlus }: { user: User; isPlus: boolean }) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const [trial] = useState(() => trialUntil(user));
  // L'abonnement Stripe (prix, prochaine date) ; null pour un compte Plus sans abonnement (accès offert)
  const { sub } = useSubscription(user.id, isPlus);
  return (
    <div className="fa fa-app" aria-label="Mon abonnement">
      <GreenHead title="Mon abonnement" sub="Frigia Plus et facturation" />
      <div className="v3-body pbody">
        {trial ? (
          <div className="subcard free-sub">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>Essai de Frigia Plus</b><span>{trialText(trial)}, sans carte bancaire</span></div>
            <Pill onClick={() => openPaywall("def")}>S'abonner</Pill>
          </div>
        ) : isPlus ? (
          <div className="subcard">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>Frigia Plus</b>{sub && <span>{subscriptionText(sub)}</span>}</div>
            {sub !== null && <button type="button" className="pill" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} onClick={() => navigate("/resilier")}>Gérer</button>}
          </div>
        ) : (
          <div className="subcard free-sub">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>Sans abonnement</b><span>Ton essai est terminé</span></div>
            <Pill onClick={() => openPaywall("def")}>Plus</Pill>
          </div>
        )}
      </div>
      <AppTabBar isPlus={isPlus} />
    </div>
  );
}
