// 22 · Tes réglages et Ton compte (prototype V3). On y arrive par la roue dentée de Famille.
// Langue : français ou anglais (lib/i18n), depuis le 4 novembre.
import { useState } from "react";
import { AUTO_LANG, lang, setLang, t, type Lang } from "../../lib/i18n";
import { useNavigate } from "react-router";
import type { User } from "../../lib/types";
import { downloadMyData, hasGoogle, isOAuthUser, linkGoogle, passwordChangedAt, unlinkGoogle } from "../../lib/account";
import { Icon, RoundButton, ScreenHeader, Sheet } from "../../ui/components";
import { agoText, MONTHS } from "../format";
import { useBack } from "../nav";
import { useOpenPaywall, type PaywallState } from "../plus/subscription";
import { trialText, trialUntil } from "../../lib/billing";
import { showToast } from "../toast";
import { authMessage } from "../onboarding/errors";
import { AccountSheet, ContactSheet, DeleteSheet, ProfileDot, type AccountMode, type Dish, type SendMode } from "./sheets";
import { NotifSettingsCard } from "../notifs/NotifSettings";
import "./settings.css";


/** Ce qui est commun aux deux écrans : le compte, et ce qu'on fait en le quittant. */
export type AccountProps = {
  user: User; name: string; avatar: string | null; isPlus: boolean;
  onSignOut: () => void;
  /** Supprime le compte côté serveur ; onGone quitte l'appli une fois « Compte supprimé » affiché. */
  onDelete: () => Promise<void>; onGone: () => void;
  /** Kilos sauvés avec les repas cuisinés, pour le merci de fin */
  savedKg: number;
};

function Row({ icon, title, sub, value, onClick, className }: {
  icon: Parameters<typeof Icon>[0]["name"]; title: string; sub?: string; value?: string; onClick: () => void; className?: string;
}) {
  return (
    <button type="button" className={"st-row" + (className ? " " + className : "")} onClick={onClick}>
      <span className="pi"><Icon name={icon} /></span>
      <b>{title}{sub && <small>{sub}</small>}</b>
      {value && <span className="st-v">{value}</span>}
      <Icon name="next" className="st-chev" />
    </button>
  );
}

export function Settings({ user, name, avatar, isPlus, onSignOut, onDelete, onGone, savedKg }: AccountProps) {
  const back = useBack();
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const [trial] = useState(() => trialUntil(user));
  const [send, setSend] = useState<SendMode | null>(null);
  const [del, setDel] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const legal = (page: string) => navigate(`/infos-legales/${page}`);
  const LANGS: [Lang, string][] = [["fr", "Français"], ["en", "English"]];

  return (
    <div className="fa fa-app st-page" aria-label={t("Tes réglages", "Your settings")}>
      <ScreenHeader title={t(<>Tes <em>réglages</em></>, <>Your <em>settings</em></>)} left={<RoundButton icon="back" label={t("Retour", "Back")} big onClick={back} />} />
      <div className="st-body">
        <span className="st-sec">{t("Ton compte", "Your account")}</span>
        <div className="st-card">
          <button type="button" className="st-row st-me" onClick={() => navigate("/reglages/compte")}>
            <ProfileDot className="pi" name={name} photo={avatar} />
            <b>{name}<small>{user.email}</small></b>
            <Icon name="next" className="st-chev" />
          </button>
          {/* En essai (ou essai fini) : s'abonner ; abonné : gérer ou résilier */}
          <Row icon="sparkle" title={t("Abonnement", "Subscription")} value={trial ? trialText(trial) : isPlus ? "Plus" : t("Aucun", "None")} onClick={() => (isPlus && !trial ? navigate("/resilier") : openPaywall("def"))} />
          {(trial || !isPlus) && <Row icon="gift" title={t("Utiliser un code", "Use a code")} value={t("7 jours en plus", "7 extra days")} onClick={() => navigate("/plus", { state: { why: "def", code: true } satisfies PaywallState })} />}
        </div>

        <span className="st-sec">Notifications</span>
        <NotifSettingsCard userId={user.id} />

        <span className="st-sec">{t("L'app", "The app")}</span>
        <div className="st-card">
          {/* Tant que la traduction n'est pas finie, le choix n'apparaît qu'en anglais (ouvert par ?lang=en) */}
          {(AUTO_LANG || lang === "en") && <Row icon="globe" title={t("Langue", "Language")} value={lang === "en" ? "English" : "Français"} onClick={() => setLangOpen(true)} />}
          <Row icon="sun" title={t("Apparence", "Appearance")} value={t("Clair", "Light")} onClick={() => showToast(t("Le mode sombre arrive bientôt", "Dark mode is coming soon"))} />
        </div>

        <span className="st-sec">{t("Aide", "Help")}</span>
        <div className="st-card">
          <Row icon="help" title={t("Questions fréquentes", "FAQ")} onClick={() => navigate("/aide")} />
          <Row icon="msg" title={t("Nous écrire", "Contact us")} value={t("Sous 24 h", "Within 24 h")} onClick={() => setSend("contact")} />
          <Row icon="alert" title={t("Signaler un problème", "Report a problem")} onClick={() => setSend("bug")} />
        </div>

        <span className="st-sec">{t("Légal", "Legal")}</span>
        <div className="st-card">
          <Row icon="shield" title={t("Confidentialité", "Privacy")} onClick={() => legal("confidentialite")} />
          <Row icon="book" title={t("Conditions d'utilisation et de vente", "Terms of use and sale")} onClick={() => legal("cgu")} />
          <Row icon="store" title={t("Mentions légales et cookies", "Legal notice and cookies")} onClick={() => legal("mentions")} />
        </div>

        <div className="st-card">
          <button type="button" className="st-row st-out" onClick={onSignOut}><span className="pi"><Icon name="logout" /></span><b>{t("Se déconnecter", "Sign out")}</b></button>
        </div>
        <button type="button" className="st-del" onClick={() => setDel(true)}>{t("Supprimer mon compte", "Delete my account")}</button>
        <p className="st-ver"><span className="st-logo" />Frigia · version 1.0</p>
      </div>
      <Sheet open={langOpen} onClose={() => setLangOpen(false)} label={t("Langue", "Language")}>
        <h3 className="stitle">{t(<>La <em>langue</em></>, <>The <em>language</em></>)}</h3>
        <div className="st-card st-langs">
          {LANGS.map(([l, label]) => (
            <button key={l} type="button" className={"st-row" + (l === lang ? " on" : "")} aria-pressed={l === lang}
              onClick={() => { setLangOpen(false); setLang(l); }}>
              <b>{label}</b>{l === lang && <Icon name="check" className="st-chev" />}
            </button>
          ))}
        </div>
      </Sheet>
      <ContactSheet mode={send} onClose={() => setSend(null)} user={user} />
      <DeleteSheet open={del} onClose={() => setDel(false)} isPlus={isPlus} user={user} onDelete={onDelete} onGone={onGone} savedKg={savedKg} />
    </div>
  );
}

export function Account({ user, name, avatar, isPlus, onSignOut, onDelete, onGone, savedKg, dishes, onAvatar, onName }: AccountProps & {
  dishes: Dish[]; onAvatar: (src: string | null) => void; onName: (name: string) => void;
}) {
  const back = useBack();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<AccountMode | null>(null);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const since = new Date(user.created_at);
  const sinceText = `${t("Depuis", "Since")} ${MONTHS[since.getMonth()]}${since.getFullYear() !== new Date().getFullYear() ? ` ${since.getFullYear()}` : ""}`;
  const changed = passwordChangedAt(user);
  const google = hasGoogle(user);

  const toggleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!google) { await linkGoogle(); return; } // part sur la page Google, revient ici
      await unlinkGoogle();
      showToast(t("Google n'est plus relié", "Google is no longer linked"));
    } catch (e) {
      showToast(google && isOAuthUser(user) ? t("Ajoute d'abord un mot de passe : sans Google, tu ne pourrais plus entrer", "Add a password first: without Google, you couldn't sign in anymore") : authMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="fa fa-app st-page" aria-label={t("Ton compte", "Your account")}>
      <ScreenHeader title={t(<>Ton <em>compte</em></>, <>Your <em>account</em></>)} left={<RoundButton icon="back" label={t("Retour", "Back")} big onClick={back} />} />
      <div className="st-body ac-body">
        <div className="ac-me">
          <button type="button" className={"ac-av" + (avatar ? " has-pp" : "")} style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
            aria-label={t("Changer ta photo de profil", "Change your profile photo")} onClick={() => setSheet("photo")}>
            <span className="acL">{name.charAt(0).toUpperCase()}</span><i><Icon name="cam" /></i>
          </button>
          <div className="ac-who">
            <button type="button" className="ac-nm" onClick={() => setSheet("photo")}><b>{name}</b></button>
            <span className="acM">{user.email}</span>
            <span className="ac-tags">
              <span className="ac-tag">{sinceText}</span>
              {trialUntil(user) ? <span className="ac-tag">{t("Essai", "Trial")}</span> : isPlus ? <span className="ac-tag gold"><Icon name="sparkle" />Plus</span> : <span className="ac-tag">{t("Sans abonnement", "No subscription")}</span>}
            </span>
          </div>
        </div>

        <span className="st-sec">{t("Tes infos", "Your details")}</span>
        <div className="st-card">
          <Row icon="user" title={t("Prénom", "First name")} value={name} onClick={() => setSheet("name")} />
          <button type="button" className="st-row" onClick={() => setSheet("email")}>
            <span className="pi"><Icon name="mail" /></span><b>Email</b><span className="st-v ac-cut">{user.email}</span><Icon name="next" className="st-chev" />
          </button>
        </div>

        <span className="st-sec">{t("Connexion", "Sign-in")}</span>
        <div className="st-card">
          <Row icon="lock" title={t("Mot de passe", "Password")} sub={changed ? t(`Changé ${agoText(changed).toLowerCase()}`, `Changed ${agoText(changed).toLowerCase()}`) : undefined} onClick={() => setSheet("pass")} />
          <div className="st-row">
            <span className="pi ac-g"><Icon name="google" /></span>
            <b>Google<small>{google ? user.email : t("Pour entrer en un geste", "Sign in with one tap")}</small></b>
            <button type="button" className={"ac-link" + (google ? " on" : "")} onClick={() => void toggleGoogle()}>
              {google ? <><Icon name="check" />{t("Relié", "Linked")}</> : t("Relier", "Link")}
            </button>
          </div>
        </div>

        <span className="st-sec">{t("Tes données", "Your data")}</span>
        <div className="st-card">
          <Row icon="share" title={t("Télécharger mes données", "Download my data")} sub={t("Un fichier avec tout ton compte", "A file with your whole account")} onClick={() => downloadMyData(user).catch(() => showToast(t("Le fichier n'a pas pu être préparé. Réessaie", "The file couldn't be prepared. Try again")))} />
          <Row icon="shield" title={t("Ce qu'on fait de tes données", "What we do with your data")} onClick={() => navigate("/infos-legales/confidentialite")} />
        </div>

        <button type="button" className="ac-out" onClick={onSignOut}><Icon name="logout" />{t("Se déconnecter", "Sign out")}</button>
        <button type="button" className="st-del" onClick={() => setDel(true)}>{t("Supprimer mon compte", "Delete my account")}</button>
      </div>
      <AccountSheet mode={sheet} onClose={() => setSheet(null)} onMode={setSheet} user={user} name={name} avatar={avatar} dishes={dishes} onAvatar={onAvatar} onName={onName} />
      <DeleteSheet open={del} onClose={() => setDel(false)} isPlus={isPlus} user={user} onDelete={onDelete} onGone={onGone} savedKg={savedKg} />
    </div>
  );
}
