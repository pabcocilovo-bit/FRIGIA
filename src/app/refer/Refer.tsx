// 25 bis · Parrainage (prototype V3) : ton lien et ton code, le partage, comment ça marche, tes invitations.
// L'ami a 7 jours d'essai en plus ; toi, un mois de Plus à son premier paiement (api/stripe-webhook.ts). Ça se cumule.
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { fetchReferral, inviteLink, setInviteCode, type Referral } from "../../lib/codes";
import { Icon, Pill, RoundButton } from "../../ui/components";
import { useBack } from "../nav";
import { showToast } from "../toast";
import { locale, t } from "../../lib/i18n";
import "../library/library.css";
import "../settings/settings.css";
import "./refer.css";

const DAY = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
const when = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? t("aujourd'hui", "today") : t(`le ${DAY.format(d)}`, `on ${DAY.format(d)}`);
};
const SPARK = "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z";

// Gardé le temps de la visite : l'écran s'ouvre tout de suite au retour
let cache: Referral | null = null;

export function Refer({ name, avatar, isPlus }: { name: string; avatar: string | null; isPlus: boolean }) {
  const back = useBack();
  const navigate = useNavigate();
  const [ref, setRef] = useState<Referral | null>(cache);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const fetchNow = () => fetchReferral().then(r => { cache = r; setRef(r); setFailed(false); }).catch(() => setFailed(true));
  const load = () => { setFailed(false); void fetchNow(); };
  useEffect(() => { void fetchNow(); }, []);

  const link = ref ? inviteLink(ref.code) : "";
  const text = ref ? t(`Je trouve quoi cuisiner avec ce qu'il y a dans mon frigo grâce à Frigia. Avec mon code ${ref.code}, tu as 7 jours d'essai en plus : ${link}`,
    `Frigia helps me find what to cook with what's in my fridge. With my code ${ref.code}, you get 7 extra trial days: ${link}`) : "";
  const copy = async (what: "link" | "code" = "link") => {
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(what === "code" ? ref.code : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
      showToast(what === "code" ? t("Code copié", "Code copied") : t("Lien copié", "Link copied"));
    } catch { showToast(t(`Ton code : ${ref.code}`, `Your code: ${ref.code}`)); }
  };
  const share = async (app?: "WhatsApp" | "Message" | "Email") => {
    if (!ref) { if (failed) load(); return; }
    const body = encodeURIComponent(text);
    if (app === "WhatsApp") { window.open(`https://wa.me/?text=${body}`, "_blank", "noopener"); return; }
    if (app === "Message") { window.location.assign(`sms:?&body=${body}`); return; }
    if (app === "Email") { window.location.assign(`mailto:?subject=${encodeURIComponent(t("2 semaines de Frigia offertes", "2 free weeks of Frigia"))}&body=${body}`); return; }
    if (navigator.share) {
      try { await navigator.share({ title: "Frigia", text, url: link }); } catch { /* fermé */ }
      return;
    }
    void copy();
  };

  const invites = ref?.invites ?? [];
  return (
    <div className="fa fa-app rf-page" aria-label={t("Parrainage", "Refer a friend")}>
      <div className="rf-hero">
        <div className="fv-row">
          <RoundButton icon="back" label={t("Retour", "Back")} tone="glass" onClick={back} />
          <RoundButton icon="help" label={t("Conditions du parrainage", "Referral terms")} tone="glass" onClick={() => navigate("/infos-legales/cgu")} />
        </div>
        <div className="rf-art" aria-hidden="true">
          <span className="rf-av" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{avatar ? null : name.charAt(0).toUpperCase()}</span>
          <svg className="rf-gift" viewBox="0 0 80 80"><rect x="15" y="35" width="50" height="35" rx="7" fill="#E0A44A" /><rect x="11" y="25" width="58" height="14" rx="5" fill="#EDB860" /><rect x="35.5" y="25" width="9" height="45" fill="#F7F1E6" /><path d="M40 25c-5-10-17-12-17-5s11 5 17 5zM40 25c5-10 17-12 17-5s-11 5-17 5z" fill="none" stroke="#F7F1E6" strokeWidth="4" strokeLinejoin="round" /></svg>
          <span className="rf-av rf-fr"><Icon name="user" /></span>
          {["a", "b", "c"].map(k => <svg key={k} className={"rf-spk " + k} viewBox="0 0 24 24"><path d={SPARK} /></svg>)}
        </div>
        <span className="rf-kick">{t("Parrainage", "Refer a friend")}</span>
        <h2>{t(<>Un mois de Plus <em>par ami abonné</em></>, <>A month of Plus <em>per subscribed friend</em></>)}</h2>
        <p>{t("Ton ami a 7 jours d'essai en plus. Toi, tu gagnes un mois de Plus dès qu'il s'abonne. 12 amis, c'est un an offert.", "Your friend gets 7 extra trial days. You earn a month of Plus as soon as they subscribe. 12 friends is a free year.")}</p>
      </div>
      <div className="rf-body">
        <div className="rf-link">
          <div><span>{t("Ton lien", "Your link")}</span>
            <b>{ref ? link.replace(/^https?:\/\//, "") : failed ? t("Pas de réseau pour l'instant", "No connection for now") : "…"}</b>
            {ref ? <small>{t("Ou ton code : ", "Or your code: ")}<button type="button" className={"rf-code" + (copied === "code" ? " ok" : "")} aria-label={t(`Copier le code ${ref.code}`, `Copy the code ${ref.code}`)} onClick={() => void copy("code")}><b>{ref.code}</b><Icon name={copied === "code" ? "check" : "copy"} /></button></small> : failed && <small><button type="button" className="link" onClick={load}>{t("Réessayer", "Try again")}</button></small>}
          </div>
          <button type="button" className={"rf-copy" + (copied === "link" ? " ok" : "")} aria-label={t("Copier le lien", "Copy the link")} disabled={!ref} onClick={() => void copy()}><Icon name={copied === "link" ? "check" : "copy"} /></button>
        </div>
        <Pill block icon="share" onClick={() => void share()}>{t("Partager mon lien", "Share my link")}</Pill>
        <div className="rf-apps">
          <button type="button" onClick={() => void share("WhatsApp")}><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round"><path d="M4.6 19.4l1.1-3.5a8 8 0 1 1 2.8 2.6z" /><path d="M9.2 8.6c-.3 2.8 3 6.3 6.2 6.2l.9-1.5-1.9-1-.9.7c-1-.4-1.8-1.2-2.3-2.2l.7-.9-1-1.9z" /></svg></span>WhatsApp</button>
          <button type="button" onClick={() => void share("Message")}><span><Icon name="msg" /></span>Message</button>
          <button type="button" onClick={() => void share("Email")}><span><Icon name="mail" /></span>Email</button>
          <button type="button" onClick={() => void share()}><span><Icon name="share" /></span>{t("Autre", "Other")}</button>
        </div>

        <span className="st-sec">{t("Comment ça marche", "How it works")}</span>
        <ol className="rf-steps">
          <li><i>1</i><div><b>{t("Tu partages ton lien", "You share your link")}</b><span>{t("Par message, sur WhatsApp, à la sortie de l'école.", "By text, on WhatsApp, at the school gate.")}</span></div></li>
          <li><i>2</i><div><b>{t("Ton ami s'inscrit avec ton code", "Your friend signs up with your code")}</b><span>{t("Il a 14 jours d'essai au lieu de 7.", "They get a 14-day trial instead of 7.")}</span></div></li>
          <li><i>3</i><div><b>{t("Il passe à Plus", "They upgrade to Plus")}</b><span>{t("Tu gagnes un mois de Plus. Ça se cumule.", "You earn a month of Plus. It adds up.")}</span></div></li>
        </ol>

        <span className="st-sec">{t("Tes invitations", "Your invitations")}</span>
        {invites.length ? <>
          <div className="rf-stats">
            <div><b>{ref?.months ?? 0}</b><span>{t(`mois gagné${(ref?.months ?? 0) > 1 ? "s" : ""}`, (ref?.months ?? 0) === 1 ? "month earned" : "months earned")}</span></div>
            <div><b>{invites.length}</b><span>{invites.length > 1 ? t("amis inscrits", "friends signed up") : t("ami inscrit", "friend signed up")}</span></div>
          </div>
          <div className="st-card rf-list">
            {invites.map((f, i) => (
              <div key={i} className="st-row">
                <span className={"rf-ini" + (f.subscribedAt ? "" : " l")}>{f.name.charAt(0).toUpperCase()}</span>
                <b>{f.name}<small>{f.subscribedAt ? t(`Sur Plus depuis ${when(f.subscribedAt)}`, `On Plus since ${when(f.subscribedAt).replace(/^on /, "")}`) : t(`Inscription ${when(f.usedAt)}, pas encore sur Plus`, `Signed up ${when(f.usedAt)}, not on Plus yet`)}</small></b>
                {f.subscribedAt ? <span className="rf-badge gold">{t("+1 mois", "+1 month")}</span> : <span className="rf-badge">{t("En attente", "Pending")}</span>}
              </div>
            ))}
          </div>
        </> : (
          <div className="rf-none"><Icon name="users" /><span>{t("Personne pour l'instant. Tes amis apparaissent ici dès qu'ils s'inscrivent avec ton lien.", "Nobody yet. Your friends show up here as soon as they sign up with your link.")}</span></div>
        )}
        <p className="rf-fine">{isPlus ? t("Ton mois offert repousse ta prochaine échéance.", "Your free month pushes back your next payment.") : t("Sans abonnement, ton mois offert démarre Plus tout seul.", "Without a subscription, your free month starts Plus on its own.")} {t("Un seul code par compte.", "One code per account.")} <a href="/infos-legales/cgu" onClick={e => { e.preventDefault(); navigate("/infos-legales/cgu"); }}>{t("Conditions", "Terms")}</a></p>
      </div>
    </div>
  );
}

/** frigia.fr/i/cami-r7q4 : le code attend l'inscription, puis l'accueil du site */
export function InviteLink() {
  const { code } = useParams();
  if (code) setInviteCode(code);
  return <Navigate to="/" replace />;
}
