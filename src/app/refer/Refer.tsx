// 25 bis · Parrainage (prototype V3) : ton lien et ton code, le partage, comment ça marche, tes invitations.
// L'ami a 7 jours d'essai en plus ; toi, un mois de Plus à son premier paiement (api/stripe-webhook.ts). Ça se cumule.
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { fetchReferral, inviteLink, setInviteCode, type Referral } from "../../lib/codes";
import { Icon, Pill, RoundButton } from "../../ui/components";
import { useBack } from "../nav";
import { showToast } from "../toast";
import "../library/library.css";
import "../settings/settings.css";
import "./refer.css";

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const when = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? "aujourd'hui" : `le ${DAY.format(d)}`;
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
  const text = ref ? `Je trouve quoi cuisiner avec ce qu'il y a dans mon frigo grâce à Frigia. Avec mon code ${ref.code}, tu as 7 jours d'essai en plus : ${link}` : "";
  const copy = async (what: "link" | "code" = "link") => {
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(what === "code" ? ref.code : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
      showToast(what === "code" ? "Code copié" : "Lien copié");
    } catch { showToast(`Ton code : ${ref.code}`); }
  };
  const share = async (app?: "WhatsApp" | "Message" | "Email") => {
    if (!ref) { if (failed) load(); return; }
    const t = encodeURIComponent(text);
    if (app === "WhatsApp") { window.open(`https://wa.me/?text=${t}`, "_blank", "noopener"); return; }
    if (app === "Message") { window.location.assign(`sms:?&body=${t}`); return; }
    if (app === "Email") { window.location.assign(`mailto:?subject=${encodeURIComponent("2 semaines de Frigia offertes")}&body=${t}`); return; }
    if (navigator.share) {
      try { await navigator.share({ title: "Frigia", text, url: link }); } catch { /* fermé */ }
      return;
    }
    void copy();
  };

  const invites = ref?.invites ?? [];
  return (
    <div className="fa fa-app rf-page" aria-label="Parrainage">
      <div className="rf-hero">
        <div className="fv-row">
          <RoundButton icon="back" label="Retour" tone="glass" onClick={back} />
          <RoundButton icon="help" label="Conditions du parrainage" tone="glass" onClick={() => navigate("/infos-legales/cgu")} />
        </div>
        <div className="rf-art" aria-hidden="true">
          <span className="rf-av" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{avatar ? null : name.charAt(0).toUpperCase()}</span>
          <svg className="rf-gift" viewBox="0 0 80 80"><rect x="15" y="35" width="50" height="35" rx="7" fill="#E0A44A" /><rect x="11" y="25" width="58" height="14" rx="5" fill="#EDB860" /><rect x="35.5" y="25" width="9" height="45" fill="#F7F1E6" /><path d="M40 25c-5-10-17-12-17-5s11 5 17 5zM40 25c5-10 17-12 17-5s-11 5-17 5z" fill="none" stroke="#F7F1E6" strokeWidth="4" strokeLinejoin="round" /></svg>
          <span className="rf-av rf-fr"><Icon name="user" /></span>
          {["a", "b", "c"].map(k => <svg key={k} className={"rf-spk " + k} viewBox="0 0 24 24"><path d={SPARK} /></svg>)}
        </div>
        <span className="rf-kick">Parrainage</span>
        <h2>Un mois de Plus <em>par ami abonné</em></h2>
        <p>Ton ami a 7 jours d'essai en plus. Toi, tu gagnes un mois de Plus dès qu'il s'abonne. 12 amis, c'est un an offert.</p>
      </div>
      <div className="rf-body">
        <div className="rf-link">
          <div><span>Ton lien</span>
            <b>{ref ? link.replace(/^https?:\/\//, "") : failed ? "Pas de réseau pour l'instant" : "…"}</b>
            {ref ? <small>Ou ton code : <button type="button" className={"rf-code" + (copied === "code" ? " ok" : "")} aria-label={`Copier le code ${ref.code}`} onClick={() => void copy("code")}><b>{ref.code}</b><Icon name={copied === "code" ? "check" : "copy"} /></button></small> : failed && <small><button type="button" className="link" onClick={load}>Réessayer</button></small>}
          </div>
          <button type="button" className={"rf-copy" + (copied === "link" ? " ok" : "")} aria-label="Copier le lien" disabled={!ref} onClick={() => void copy()}><Icon name={copied === "link" ? "check" : "copy"} /></button>
        </div>
        <Pill block icon="share" onClick={() => void share()}>Partager mon lien</Pill>
        <div className="rf-apps">
          <button type="button" onClick={() => void share("WhatsApp")}><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round"><path d="M4.6 19.4l1.1-3.5a8 8 0 1 1 2.8 2.6z" /><path d="M9.2 8.6c-.3 2.8 3 6.3 6.2 6.2l.9-1.5-1.9-1-.9.7c-1-.4-1.8-1.2-2.3-2.2l.7-.9-1-1.9z" /></svg></span>WhatsApp</button>
          <button type="button" onClick={() => void share("Message")}><span><Icon name="msg" /></span>Message</button>
          <button type="button" onClick={() => void share("Email")}><span><Icon name="mail" /></span>Email</button>
          <button type="button" onClick={() => void share()}><span><Icon name="share" /></span>Autre</button>
        </div>

        <span className="st-sec">Comment ça marche</span>
        <ol className="rf-steps">
          <li><i>1</i><div><b>Tu partages ton lien</b><span>Par message, sur WhatsApp, à la sortie de l'école.</span></div></li>
          <li><i>2</i><div><b>Ton ami s'inscrit avec ton code</b><span>Il a 14 jours d'essai au lieu de 7.</span></div></li>
          <li><i>3</i><div><b>Il passe à Plus</b><span>Tu gagnes un mois de Plus. Ça se cumule.</span></div></li>
        </ol>

        <span className="st-sec">Tes invitations</span>
        {invites.length ? <>
          <div className="rf-stats">
            <div><b>{ref?.months ?? 0}</b><span>mois gagné{(ref?.months ?? 0) > 1 ? "s" : ""}</span></div>
            <div><b>{invites.length}</b><span>{invites.length > 1 ? "amis inscrits" : "ami inscrit"}</span></div>
          </div>
          <div className="st-card rf-list">
            {invites.map((f, i) => (
              <div key={i} className="st-row">
                <span className={"rf-ini" + (f.subscribedAt ? "" : " l")}>{f.name.charAt(0).toUpperCase()}</span>
                <b>{f.name}<small>{f.subscribedAt ? `Sur Plus depuis ${when(f.subscribedAt)}` : `Inscription ${when(f.usedAt)}, pas encore sur Plus`}</small></b>
                {f.subscribedAt ? <span className="rf-badge gold">+1 mois</span> : <span className="rf-badge">En attente</span>}
              </div>
            ))}
          </div>
        </> : (
          <div className="rf-none"><Icon name="users" /><span>Personne pour l'instant. Tes amis apparaissent ici dès qu'ils s'inscrivent avec ton lien.</span></div>
        )}
        <p className="rf-fine">{isPlus ? "Ton mois offert repousse ta prochaine échéance." : "Sans abonnement, ton mois offert démarre Plus tout seul."} Un seul code par compte. <a href="/infos-legales/cgu" onClick={e => { e.preventDefault(); navigate("/infos-legales/cgu"); }}>Conditions</a></p>
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
