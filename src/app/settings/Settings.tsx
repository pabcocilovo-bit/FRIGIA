// 22 · Tes réglages et Ton compte (prototype V3). On y arrive par la roue dentée de Famille.
// Pas encore là : « Utiliser un code » (étape 11), Notifications (étape 12), Langue (l'appli n'existe qu'en français).
import { useState } from "react";
import { useNavigate } from "react-router";
import type { User } from "../../lib/types";
import { downloadMyData, hasGoogle, isOAuthUser, linkGoogle, passwordChangedAt, unlinkGoogle } from "../../lib/account";
import { Icon, RoundButton, ScreenHeader } from "../../ui/components";
import { agoText } from "../format";
import { useBack } from "../nav";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import { authMessage } from "../onboarding/errors";
import { AccountSheet, ContactSheet, DeleteSheet, ProfileDot, type AccountMode, type Dish, type SendMode } from "./sheets";
import "./settings.css";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

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
  const [send, setSend] = useState<SendMode | null>(null);
  const [del, setDel] = useState(false);
  const legal = (page: string) => navigate(`/infos-legales/${page}`);

  return (
    <div className="fa fa-app st-page" aria-label="Tes réglages">
      <ScreenHeader title={<>Tes <em>réglages</em></>} left={<RoundButton icon="back" label="Retour" big onClick={back} />} />
      <div className="st-body">
        <span className="st-sec">Ton compte</span>
        <div className="st-card">
          <button type="button" className="st-row st-me" onClick={() => navigate("/reglages/compte")}>
            <ProfileDot className="pi" name={name} photo={avatar} />
            <b>{name}<small>{user.email}</small></b>
            <Icon name="next" className="st-chev" />
          </button>
          <Row icon="sparkle" title="Abonnement" value={isPlus ? "Plus" : "Gratuit"} onClick={() => (isPlus ? navigate("/resilier") : openPaywall("def"))} />
        </div>

        <span className="st-sec">L'app</span>
        <div className="st-card">
          <Row icon="sun" title="Apparence" value="Clair" onClick={() => showToast("Le mode sombre arrive bientôt")} />
        </div>

        <span className="st-sec">Aide</span>
        <div className="st-card">
          <Row icon="help" title="Questions fréquentes" onClick={() => navigate("/aide")} />
          <Row icon="msg" title="Nous écrire" value="Sous 24 h" onClick={() => setSend("contact")} />
          <Row icon="alert" title="Signaler un problème" onClick={() => setSend("bug")} />
        </div>

        <span className="st-sec">Légal</span>
        <div className="st-card">
          <Row icon="shield" title="Confidentialité" onClick={() => legal("confidentialite")} />
          <Row icon="book" title="Conditions d'utilisation et de vente" onClick={() => legal("cgu")} />
          <Row icon="store" title="Mentions légales et cookies" onClick={() => legal("mentions")} />
        </div>

        <div className="st-card">
          <button type="button" className="st-row st-out" onClick={onSignOut}><span className="pi"><Icon name="logout" /></span><b>Se déconnecter</b></button>
        </div>
        <button type="button" className="st-del" onClick={() => setDel(true)}>Supprimer mon compte</button>
        <p className="st-ver"><span className="st-logo" />Frigia · version 1.0</p>
      </div>
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
  const sinceText = `Depuis ${MONTHS[since.getMonth()]}${since.getFullYear() !== new Date().getFullYear() ? ` ${since.getFullYear()}` : ""}`;
  const changed = passwordChangedAt(user);
  const google = hasGoogle(user);

  const toggleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!google) { await linkGoogle(); return; } // part sur la page Google, revient ici
      await unlinkGoogle();
      showToast("Google n'est plus relié");
    } catch (e) {
      showToast(google && isOAuthUser(user) ? "Ajoute d'abord un mot de passe : sans Google, tu ne pourrais plus entrer" : authMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="fa fa-app st-page" aria-label="Ton compte">
      <ScreenHeader title={<>Ton <em>compte</em></>} left={<RoundButton icon="back" label="Retour" big onClick={back} />} />
      <div className="st-body ac-body">
        <div className="ac-me">
          <button type="button" className={"ac-av" + (avatar ? " has-pp" : "")} style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
            aria-label="Changer ta photo de profil" onClick={() => setSheet("photo")}>
            <span className="acL">{name.charAt(0).toUpperCase()}</span><i><Icon name="cam" /></i>
          </button>
          <div className="ac-who">
            <button type="button" className="ac-nm" onClick={() => setSheet("photo")}><b>{name}</b></button>
            <span className="acM">{user.email}</span>
            <span className="ac-tags">
              <span className="ac-tag">{sinceText}</span>
              {isPlus ? <span className="ac-tag gold"><Icon name="sparkle" />Plus</span> : <span className="ac-tag">Gratuit</span>}
            </span>
          </div>
        </div>

        <span className="st-sec">Tes infos</span>
        <div className="st-card">
          <Row icon="user" title="Prénom" value={name} onClick={() => setSheet("name")} />
          <button type="button" className="st-row" onClick={() => setSheet("email")}>
            <span className="pi"><Icon name="mail" /></span><b>Email</b><span className="st-v ac-cut">{user.email}</span><Icon name="next" className="st-chev" />
          </button>
        </div>

        <span className="st-sec">Connexion</span>
        <div className="st-card">
          <Row icon="lock" title="Mot de passe" sub={changed ? `Changé ${agoText(changed).toLowerCase()}` : undefined} onClick={() => setSheet("pass")} />
          <div className="st-row">
            <span className="pi ac-g"><Icon name="google" /></span>
            <b>Google<small>{google ? user.email : "Pour entrer en un geste"}</small></b>
            <button type="button" className={"ac-link" + (google ? " on" : "")} onClick={() => void toggleGoogle()}>
              {google ? <><Icon name="check" />Relié</> : "Relier"}
            </button>
          </div>
        </div>

        <span className="st-sec">Tes données</span>
        <div className="st-card">
          <Row icon="share" title="Télécharger mes données" sub="Un fichier avec tout ton compte" onClick={() => downloadMyData(user).catch(() => showToast("Le fichier n'a pas pu être préparé. Réessaie"))} />
          <Row icon="shield" title="Ce qu'on fait de tes données" onClick={() => navigate("/infos-legales/confidentialite")} />
        </div>

        <button type="button" className="ac-out" onClick={onSignOut}><Icon name="logout" />Se déconnecter</button>
        <button type="button" className="st-del" onClick={() => setDel(true)}>Supprimer mon compte</button>
      </div>
      <AccountSheet mode={sheet} onClose={() => setSheet(null)} onMode={setSheet} user={user} name={name} avatar={avatar} dishes={dishes} onAvatar={onAvatar} onName={onName} />
      <DeleteSheet open={del} onClose={() => setDel(false)} isPlus={isPlus} user={user} onDelete={onDelete} onGone={onGone} savedKg={savedKg} />
    </div>
  );
}
