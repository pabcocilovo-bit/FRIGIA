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
import { longDate, subscriptionText, useOpenPaywall, useSubscription } from "./plus/subscription";
import { trialText, trialUntil } from "../lib/billing";
import { AccountSheet, type AccountMode, type Dish } from "./settings/sheets";
import { BETA } from "./beta/survey";
import { isAdmin } from "./admin/admin";
import { t } from "../lib/i18n";

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
    <div className="fa fa-app" aria-label={t("Mon profil", "My profile")}>
      <GreenHead title={t("Mon profil", "My profile")}>
        <div className="mp-me">
          <div className="pav">
            <Avatar user={user} name={name} photo={avatar} className="plate pav-av mp-av" label={t("Ta photo de profil", "Your profile photo")} />
            <button type="button" className="pedit" aria-label={t("Changer ta photo de profil", "Change your profile photo")} onClick={() => setSheet("photo")}><Icon name="cam" /></button>
          </div>
          <button type="button" className="mp-id" onClick={() => navigate("/reglages/compte")}>
            <span className="tx">
              <b>{name}</b>
              <span>{memberSince(user)}</span>
              {isPlus && !trial
                ? <span className="plus-tag"><Icon name="sparkle" />Frigia Plus</span>
                : <span className="plus-tag">{trial ? t("Essai de Frigia Plus", "Frigia Plus trial") : t("Sans abonnement", "No subscription")}</span>}
            </span>
            <Icon name="next" />
          </button>
        </div>
      </GreenHead>

      <div className="v3-body mp-body">
        <button type="button" className="sp-hi mp-refer" onClick={() => navigate("/parrainage")}>
          <Icon name="gift" />
          <span className="tx"><b>{t("Invite tes amis, gagne du Plus !", "Invite your friends, earn Plus!")}</b><span>{t("1 mois de Frigia Plus offert par ami abonné.", "1 free month of Frigia Plus for each friend who subscribes.")}</span></span>
          <Icon name="next" />
        </button>

        <div className="mp-card">
          <MenuRow icon="users" title={t("Mon foyer", "My household")} sub={t("Membres et profils alimentaires", "Members and dietary profiles")} onClick={() => navigate("/famille/foyer")} />
          <MenuRow icon="salad" title={t("Mes préférences", "My preferences")} sub={t("Régime, ustensiles et temps disponible", "Diet, equipment and time available")} onClick={() => navigate("/famille/preferences")} />
          <MenuRow icon="cart" title={t("Budget courses", "Grocery budget")} sub={t("Dépenses et budget mensuel", "Expenses and monthly budget")} lock={!isPlus}
            onClick={() => (isPlus ? navigate("/famille/budget") : openPaywall("budget", "/famille/budget"))} />
          <MenuRow icon="crown" title={t("Mon abonnement", "My subscription")} sub={trial ? trialText(trial) : t("Frigia Plus et facturation", "Frigia Plus and billing")} onClick={() => navigate("/famille/abonnement")} />
        </div>

        <div className="mp-card">
          <MenuRow icon="user" title={t("Compte et sécurité", "Account and security")} sub={t("Informations personnelles, connexion", "Personal details, sign-in")} onClick={() => navigate("/reglages/compte")} />
          <MenuRow icon="gear" title={t("Réglages de l'application", "App settings")} sub={t("Notifications, apparence, infos légales", "Notifications, appearance, legal")} onClick={() => navigate("/reglages")} />
          {BETA && <MenuRow icon="msg" title={t("Donner mon avis", "Give feedback")} sub={t("Le questionnaire de la bêta, 2 minutes", "The beta survey, 2 minutes")} onClick={() => navigate("/avis")} />}
          <MenuRow icon="help" title={t("Aide et contact", "Help and contact")} sub={t("Questions fréquentes, nous écrire", "FAQ, contact us")} onClick={() => navigate("/aide")} />
        </div>

        {/* Seulement pour l'admin (app_metadata.admin) */}
        {isAdmin(user) && (
          <div className="mp-card">
            <MenuRow icon="chart" title="Dashboard de suivi" sub="Comptes, activité, problèmes et abus" onClick={() => navigate("/admin")} />
          </div>
        )}

        <button type="button" className="mp-out" onClick={onSignOut}>
          <Icon name="logout" /><b>{t("Se déconnecter", "Sign out")}</b><Icon name="next" />
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
    <div className="fa fa-app" aria-label={t("Mon foyer", "My household")}>
      <GreenHead title={t("Mon foyer", "My household")} sub={t("Membres et profils alimentaires", "Members and dietary profiles")} />
      <div className="v3-body pbody">
        {isPlus ? <>
          <div className="plist">
            {household.map(p => {
              const sub = memberSub(p), pp = p.me && avatar;
              return (
                <button key={p.id} type="button" className="prow" onClick={() => navigate(`/famille/proche/${p.id}`)}>
                  <span className={"ini" + (p.kid ? " k" : "") + (pp ? " has-pp" : "")} style={pp ? { backgroundImage: `url(${avatar})` } : undefined}>{p.name.charAt(0).toUpperCase()}</span>
                  <span className="tx"><b>{p.name}{p.kid ? t(`, ${p.age} ans`, `, ${p.age}`) : ""}</b><span className={sub.alert ? "add" : undefined}>{sub.text}</span></span>
                  <Icon name="next" />
                </button>
              );
            })}
          </div>
          <Pill icon="plus" block onClick={() => navigate("/famille/proche")}>{t("Ajouter un proche", "Add someone")}</Pill>
        </> : (
          <div className="famcta">
            <span className="avs"><span className="ini">C</span><span className="ini">T</span><span className="ini k">L</span><span className="ini k">J</span></span>
            <b>{t("Ajoute ta famille", "Add your family")}</b>
            <p>{t("L'âge, les allergies et ce que chacun n'aime pas. Les portions se calculent toutes seules.", "Ages, allergies and what each person dislikes. Portions are worked out for you.")}</p>
            <Pill onClick={() => openPaywall("famille")}>{t("Découvrir Plus", "Discover Plus")}</Pill>
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
    <div className="fa fa-app" aria-label={t("Mes préférences", "My preferences")}>
      <GreenHead title={t("Mes préférences", "My preferences")} sub={t("Enregistrées sur ton compte, sur tous tes appareils", "Saved to your account, on all your devices")} />
      <div className="v3-body pbody">
        {tastes && (
          <div className="plist">
            {/* Les 3 lignes restent, même vides : on invite à compléter */}
            {([["salad", t("Régime", "Diet"), tastes.diet, 2, ""], ["pan", t("Ustensiles", "Equipment"), tastes.equipment, 3, t("Ajoute ton matériel", "Add your equipment")], ["clock", t("Temps en semaine", "Time on weekdays"), tastes.time, 3, t("Indique ton temps", "Tell us your time")]] as const)
              .map(([icon, title, value, question, empty]) => (
                <button key={title} type="button" className="prow" onClick={() => onEditTastes(question)}>
                  <span className="pi"><Icon name={icon} /></span><span className="tx"><b>{title}</b>{value ? <span>{value}</span> : <span className="add">{empty}</span>}</span><Icon name="next" />
                </button>
              ))}
          </div>
        )}
        <Pill tone="cream" block onClick={() => onEditTastes()}>{t("Tout modifier", "Edit everything")}</Pill>
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
  const { sub, failed } = useSubscription(user.id, isPlus);
  // Plus sans abonnement Stripe (accès offert, mois offerts) : rien à gérer, donc pas de « Gérer »
  const until = user.app_metadata?.plus_until;
  const offered = typeof until === "number" && !user.app_metadata?.is_whitelisted ? t(`Offert jusqu'au ${longDate(until)}`, `Free until ${longDate(until)}`) : t("Accès offert, rien à payer", "Free access, nothing to pay");
  return (
    <div className="fa fa-app" aria-label={t("Mon abonnement", "My subscription")}>
      <GreenHead title={t("Mon abonnement", "My subscription")} sub={t("Frigia Plus et facturation", "Frigia Plus and billing")} />
      <div className="v3-body pbody">
        {trial ? (
          <div className="subcard free-sub">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>{t("Essai de Frigia Plus", "Frigia Plus trial")}</b><span>{trialText(trial)}{t(", sans carte bancaire", ", no card needed")}</span></div>
            <Pill onClick={() => openPaywall("def")}>{t("S'abonner", "Subscribe")}</Pill>
          </div>
        ) : isPlus ? (
          <div className="subcard">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>Frigia Plus</b>{sub ? <span>{subscriptionText(sub)}</span> : sub === null ? <span>{offered}</span> : null}</div>
            {/* Seulement quand l'abonnement est là (ou n'a pas pu se charger : Résilier réessaie) ; sinon Résilier renverrait ici */}
            {(sub || (sub === undefined && failed)) && <button type="button" className="pill" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} onClick={() => navigate("/resilier")}>{t("Gérer", "Manage")}</button>}
          </div>
        ) : (
          <div className="subcard free-sub">
            <span className="pi"><Icon name="sparkle" /></span>
            <div><b>{t("Sans abonnement", "No subscription")}</b><span>{t("Ton essai est terminé", "Your trial is over")}</span></div>
            <Pill onClick={() => openPaywall("def")}>Plus</Pill>
          </div>
        )}
      </div>
      <AppTabBar isPlus={isPlus} />
    </div>
  );
}
