// Gratuit et Plus (prototype V3) : Passe à Plus, On attend ta banque / Paiement refusé, Bienvenue dans Plus,
// Résilier (avec la pause d'un mois), et la feuille « Bienvenue » de l'accueil après l'inscription.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { supabase } from "../../supabase";
import { checkoutUrl, expiredCardMonth, fetchOffers, isPlus, subscriptionAction, type PlanChoice, type Subscription } from "../../lib/billing";
import type { User } from "../../lib/types";
import { Icon, Pill, RoundButton } from "../../ui/components";
import { LOGO_SYMBOL } from "../logo";
import { useBack } from "../nav";
import { showToast } from "../toast";
import { PLUS_ART } from "./art";
import { WHY, checkoutChoice, isYearly, longDate, priceText, rememberCheckout, useSubscription, type PaywallState, type Why } from "./subscription";
import "./plus.css";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const failText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Ça n'a pas marché. Réessaie.");

/** Ouvre la page de paiement Stripe pour la formule choisie (ou le portail pour changer de carte). */
async function goToCheckout(plan: PlanChoice, go: string | undefined) {
  rememberCheckout(plan, go);
  const { url } = await checkoutUrl(plan);
  if (!url) throw new Error("");
  window.location.href = url;
}

// ─── Passe à Plus ────────────────────────────────────────────────────────────

const CMP: [string, string, string | null][] = [
  ["Scans du frigo", "15 en tout", "Illimités"],
  ["Mode famille", "–", null],
  ["Planning de la semaine", "–", null],
  ["Liste de courses", "–", null],
  ["Économies du mois", "Aperçu", "Complet"],
  ["Historique", "7 jours", "Tout"],
];

export function Paywall() {
  const location = useLocation();
  const back = useBack();
  const state = (location.state ?? {}) as PaywallState;
  const why = WHY[state.why as Why] ?? WHY.def;
  const [plan, setPlan] = useState<PlanChoice>("year");
  // Prix fondateur tant qu'il reste des places parmi les 500 premiers abonnés annuels
  const [founder, setFounder] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchOffers().then(o => { if (live) setFounder(o.founderLeft > 0); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const yearPrice = founder ? "29,99 €/an" : "39,99 €/an";
  const pay = async () => {
    setBusy(true);
    try { await goToCheckout(plan, state.go); } catch (e) { setBusy(false); showToast(failText(e)); }
  };

  return (
    <section className="fa ob-screen scr-paywall" aria-label="Passe à Frigia Plus">
      <div className="pw-top">
        <RoundButton icon="x" label="Fermer" tone="glass" onClick={back} />
        <span />
      </div>
      <div className="scroll">
        <div className="pw-body">
          <div className="pw-plates">
            <img className="plate" src="/landing/soupe-detox.jpg" alt="" />
            <img className="plate" src="/landing/pasta-legumes.jpg" alt="" />
            <img className="plate" src="/landing/wrap-proteine.jpg" alt="" />
          </div>
          <div className="pw-h">
            <span className="label">Pour toute la famille</span>
            <h2>Frigia <em>Plus</em></h2>
            <p>{why}</p>
          </div>
          <div className="cmp">
            <div className="cmp-row cmp-head"><span style={{ textAlign: "left" }} /><span>Gratuit</span><span>Plus</span></div>
            {CMP.map(([t, free, plus]) => (
              <div key={t} className="cmp-row">{t}<span className={free === "–" ? "no" : undefined}>{free}</span><span className="p">{plus ?? <Icon name="check" />}</span></div>
            ))}
          </div>
          <div className="offers" role="radiogroup" aria-label="Formule">
            <button type="button" role="radio" aria-checked={plan === "year"} className={cx("offer", plan === "year" && "on")} onClick={() => setPlan("year")}>
              <span className="rd" />
              {founder
                ? <div><span className="lockpill">Prix fondateur</span><b>Annuel</b><small>Pour les 500 premiers abonnés</small></div>
                : <div><b>Annuel</b></div>}
              <span className="pr">{founder ? <><s>39,99 €</s>29,99 €/an</> : "39,99 €/an"}</span>
            </button>
            <button type="button" role="radio" aria-checked={plan === "month"} className={cx("offer", plan === "month" && "on")} onClick={() => setPlan("month")}>
              <span className="rd" />
              <div><b>Mensuel</b><small>Sans engagement</small></div>
              <span className="pr">6,99 €/mois</span>
            </button>
          </div>
        </div>
      </div>
      <div className="pw-foot">
        <Pill tone="cream" disabled={busy} onClick={pay}>Passer à Plus · {plan === "year" ? yearPrice : "6,99 €/mois"}</Pill>
        <small>Sans engagement. Paiement sécurisé par Stripe.</small>
      </div>
    </section>
  );
}

// ─── On attend ta banque / Paiement refusé (retour de la page Stripe) ───────

const STUCK = ["incomplete", "past_due", "unpaid"];

export function PayReturn() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  // Retour du portail Stripe après avoir changé de carte
  const card = params.has("carte");
  // Renouvellement refusé (ouvert depuis l'accueil) : le refus tout de suite, sans attendre la banque
  const [ko, setKo] = useState(params.has("refus"));
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState<string | null>(null);

  // La raison du refus : seulement « carte expirée », sinon la phrase générale
  useEffect(() => {
    if (!ko) return;
    let live = true;
    expiredCardMonth().then(m => { if (live) setExpired(m); }).catch(() => { /* phrase générale */ });
    return () => { live = false; };
  }, [ko]);

  // Le webhook Stripe écrit l'abonnement sur le compte : on relit la session jusqu'à le voir (20 s au plus).
  // Avec une nouvelle carte, on retente d'abord le paiement en attente.
  useEffect(() => {
    if (ko) return;
    let live = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (card && tries === 0) {
        try { await subscriptionAction("retry"); } catch { if (live) setKo(true); return; }
        if (!live) return;
      }
      const { data } = await supabase.auth.refreshSession();
      if (!live) return;
      const u = data.session?.user ?? null;
      if (u && isPlus(u)) { navigate("/plus/bienvenue", { replace: true }); return; }
      tries++;
      if (tries >= 10 || (tries >= 4 && STUCK.includes(u?.app_metadata?.subscription_status))) { setKo(true); return; }
      timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 1200);
    return () => { live = false; clearTimeout(timer); };
  }, [ko, card, navigate]);

  const updateCard = async () => {
    setBusy(true);
    const { plan, go } = checkoutChoice();
    try { await goToCheckout(plan, go); } catch (e) { setBusy(false); showToast(failText(e)); }
  };

  return (
    <section className={cx("fa ob-screen scr-payfail on", ko && "ko")} aria-label={ko ? "Paiement refusé" : "Paiement en cours"}>
      <div className="fg-top">
        <button type="button" className="fg-x" aria-label="Fermer" onClick={() => navigate("/plus", { replace: true, state: { go: checkoutChoice().go } })}><Icon name="x" /></button>
      </div>
      <div className="scroll">
        <div className="pf-body">
          <div className="pf-art" aria-hidden="true">
            <div className="pf-card">
              <span className="pf-logo" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL }} />
              <span className="pf-chip" />
              <span className="pf-l1" /><span className="pf-l2" />
            </div>
            <span className="pf-badge"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" /></svg></span>
          </div>
          <div className="pf-wait" aria-live="polite">
            <h2>{card ? <>On valide <em>ta carte</em></> : <>On attend <em>ta banque</em></>}</h2>
            <p>Ça prend quelques secondes. Si ta banque t'envoie une notification, valide-la.</p>
            <span className="pf-dots"><i /><i /><i /></span>
          </div>
          <div className="pf-ko" role={ko ? "alert" : undefined}>
            <h2>Paiement <em>refusé</em></h2>
            <p>{expired ? `Ta carte bancaire a expiré fin ${expired}.` : "Ta banque n'a pas validé le paiement."} Rien n'a été débité.</p>
            <p className="pf-keep"><Icon name="check" /><span>Tes scans gratuits et tes favoris restent là.</span></p>
          </div>
        </div>
      </div>
      <div className="sf-foot pf-foot">
        <Pill block disabled={busy} onClick={updateCard}>Mettre à jour ma carte</Pill>
        <button type="button" className="link" onClick={() => navigate("/", { replace: true })}>Rester en Gratuit pour l'instant</button>
        <span className="pf-safe"><Icon name="lock" />Paiement sécurisé par Stripe</span>
      </div>
    </section>
  );
}

// ─── Bienvenue dans Plus ─────────────────────────────────────────────────────

function validLabel(sub: Subscription): string {
  if (sub.plan === "founder") return "Prix fondateur · valable jusqu'au";
  return isYearly(sub) ? "Annuel · valable jusqu'au" : "Mensuel · prochain paiement le";
}

export function PlusWelcome({ user, name }: { user: User; name: string | null }) {
  const navigate = useNavigate();
  const { sub } = useSubscription(user.id);
  const later = () => navigate(checkoutChoice().go || "/", { replace: true });

  return (
    <section className="fa ob-screen scr-plusok play" aria-label="Bienvenue dans Frigia Plus">
      <div className="po-main">
        <div className="po-h">
          <h2>Bienvenue dans <em>Plus</em>&nbsp;!</h2>
          <p>Merci{name ? ` ${name}` : ""}. Toute la famille mange mieux, et ton frigo ne gâche plus rien.</p>
        </div>
        <div className="po-art" dangerouslySetInnerHTML={{ __html: PLUS_ART }} />
        {sub !== null && (
          <div className="po-valid" style={sub ? undefined : { visibility: "hidden" }}>
            <span className="label">{sub ? validLabel(sub) : "Prix fondateur · valable jusqu'au"}</span>
            <b>{sub ? longDate(sub.periodEnd, true) : "…"}</b>
          </div>
        )}
        <ul className="po-unl" aria-label="Ce qui est débloqué">
          {["Scans illimités", "Mode famille", "Planning", "Liste de courses"].map(t => <li key={t}><Icon name="check" />{t}</li>)}
        </ul>
      </div>
      <div className="po-foot">
        <Pill block icon="users" onClick={() => navigate("/famille/proche", { replace: true })}>Ajouter ma famille</Pill>
        <button type="button" className="po-later" onClick={later}>Plus tard</button>
      </div>
    </section>
  );
}

// ─── Résilier (« Gérer » dans Famille) : 3 clics, aussi visibles que « Garder Plus » ──

const REASONS = [
  "C'est trop cher pour moi",
  "Je ne cuisine pas assez souvent",
  "Les recettes ne me plaisent pas",
  "Le scan se trompe trop",
  "Autre chose",
];

type Step = "offer" | "why" | "done";
const isPaused = (sub: Subscription) => !!sub.pauseUntil && !sub.cancelAtPeriodEnd;

function doneText(sub: Subscription): string {
  if (!isPaused(sub)) return `Plus reste actif jusqu'au ${longDate(sub.periodEnd)}, puis tu passes en Gratuit.`;
  return isYearly(sub)
    ? `Plus se met en veille un mois. Ton année est prolongée d'autant : renouvelée le ${longDate(sub.periodEnd)}.`
    : `Pas de paiement le ${longDate(sub.pauseFrom ?? sub.periodEnd)}. Plus reprend tout seul le ${longDate(sub.pauseUntil ?? sub.periodEnd)}.`;
}

export function Cancel({ user }: { user: User }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sub, failed, update } = useSubscription(user.id);
  const [step, setStep] = useState<Step | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Déjà résilié ou en pause : on ouvre directement sur « C'est noté » / « Bonne pause »
  const shown: Step = step ?? (sub && (sub.cancelAtPeriodEnd || sub.pauseUntil) ? "done" : "offer");

  const close = () => (location.key === "default" ? navigate("/famille", { replace: true }) : navigate(-1));
  const keep = () => { showToast("Plus continue, rien ne change"); setTimeout(close, 500); };

  useEffect(() => {
    if (sub === null) navigate("/famille", { replace: true });
  }, [sub, navigate]);
  useEffect(() => {
    if (failed && sub === undefined) showToast("Ça n'a pas marché. Réessaie.");
  }, [failed, sub]);

  const run = async (action: "cancel" | "undo" | "pause" | "resume", then: () => void) => {
    if (busy || !sub) return;
    setBusy(true);
    try {
      const s = await subscriptionAction(action, action === "cancel" ? reason ?? undefined : undefined);
      update(s);
      // La pause change le compte (Plus en veille) : la session suit tout de suite
      void supabase.auth.refreshSession();
      then();
    } catch (e) {
      showToast(failText(e));
    } finally {
      setBusy(false);
    }
  };

  const paused = !!sub && isPaused(sub);
  const founder = sub?.plan === "founder";

  return (
    <section className="fa ob-screen scr-cancel play" aria-label="Résilier Frigia Plus">
      <div className="cx-back" aria-hidden="true" onClick={close}>
        <span className="label">Ton abonnement</span>
        <b>Frigia <em>Plus</em></b>
        <span>{sub ? (sub.cancelAtPeriodEnd ? `Se termine le ${longDate(sub.periodEnd)}` : sub.pauseUntil ? (isYearly(sub) ? `En pause jusqu'au ${longDate(sub.pauseUntil)}` : "En pause") : priceText(sub)) : ""}</span>
      </div>
      <button type="button" className="fg-x cx-x" aria-label="Fermer" onClick={close}><Icon name="x" /></button>
      <div className="cx-sheet">
        <span className="grab" />

        <div className={cx("cx-step", shown === "offer" && "on")}>
          <div className="cx-scroll"><div className="cx-in">
            <div className="cx-art" aria-hidden="true">
              <span className="fg-tile" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL }} />
              <i className="d1" /><i className="d2" />
            </div>
            {/* « Continue de sauver 22,60 € par mois » : le montant viendra du bilan d'économies (étape 9) */}
            <h2>Continue avec <em>Plus</em></h2>
            <p>En Gratuit, tu repasses à 15 scans, sans la famille ni ta semaine.{founder ? " Et ton prix fondateur ne reviendra pas." : ""}</p>
            {sub?.canPause && (
              <button type="button" className="cx-pause" disabled={busy} onClick={() => run("pause", () => setStep("done"))}>
                <span><Icon name="clock" /></span>
                <div><b>Une pause d'un mois</b>Rien à payer, tout reste là</div>
                <Icon name="next" />
              </button>
            )}
          </div></div>
          <div className="cx-foot">
            <Pill block onClick={keep}>Garder Plus</Pill>
            <button type="button" className="pill block cx-no" disabled={!sub} onClick={() => setStep("why")}>Oui, résilier</button>
          </div>
        </div>

        <div className={cx("cx-step", shown === "why" && "on")}>
          <button type="button" className="cx-bk" aria-label="Retour" onClick={() => setStep("offer")}><Icon name="back" /></button>
          <div className="cx-scroll"><div className="cx-in">
            <h2>Pourquoi tu <em>pars ?</em></h2>
            <p>Facultatif. Ta réponse nous aide à améliorer Frigia.</p>
            <div className="cx-why" role="radiogroup" aria-label="Pourquoi tu pars">
              {REASONS.map(r => (
                <button key={r} type="button" role="radio" aria-checked={reason === r} className={reason === r ? "on" : undefined}
                  onClick={() => setReason(reason === r ? null : r)}>{r}</button>
              ))}
            </div>
          </div></div>
          <div className="cx-foot">
            <button type="button" className="pill block cx-conf" disabled={busy} onClick={() => run("cancel", () => setStep("done"))}>Confirmer la résiliation</button>
            <button type="button" className="pill block cx-line" onClick={keep}>Finalement, je garde Plus</button>
          </div>
        </div>

        <div className={cx("cx-step", shown === "done" && "on")}>
          <div className="cx-scroll"><div className="cx-in">
            <div className="cx-art" aria-hidden="true">
              <span className="fg-tile" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL }} />
              <span className={cx("cx-badge", paused && "pz")}><Icon name={paused ? "clock" : "check"} /></span>
            </div>
            <h2>{paused ? <>Bonne <em>pause</em></> : <>C'est <em>noté</em></>}</h2>
            <p>{sub ? doneText(sub) : ""}</p>
            <p className="cx-note">{paused
              ? "Tes favoris, ta semaine et ta famille t'attendent. On te prévient la veille de la reprise."
              : "Rien ne disparaît : tes favoris, ta liste et tes scans restent là. Un email de confirmation est parti."}</p>
          </div></div>
          <div className="cx-foot">
            <Pill block onClick={close}>Retour à mon compte</Pill>
            <button type="button" className="pill block cx-line" disabled={busy} onClick={() => run(paused ? "resume" : "undo", keep)}>
              <span>{paused ? "Reprendre maintenant" : "Je change d'avis"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Feuille « Bienvenue » sur l'accueil, juste après l'inscription ──────────

export function HelloSheet({ name, onScan, onClose }: { name: string | null; onScan: () => void; onClose: () => void }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 350);
    return () => clearTimeout(t);
  }, []);
  const hide = () => { setOn(false); setTimeout(onClose, 300); };

  return (
    // Posée par-dessus l'accueil, hors de son bloc : le style .fa vient de cet emballage
    <div className="fa">
    <div className={cx("ob-hello", on && "on")} aria-hidden={!on} onClick={e => { if (e.target === e.currentTarget) hide(); }}>
      <div className="sheet" role="dialog" aria-label="Bienvenue">
        <span className="grab" />
        <div className="top">
          <img className="plate" src="/landing/pasta-legumes.jpg" alt="" />
          <h2>Bienvenue{name ? <> <em>{name}</em></> : null}&nbsp;!</h2>
        </div>
        <p>Ton Frigia est prêt. Ouvre ton frigo, prends une photo, et trois recettes arrivent.</p>
        <div className="qd"><span className="qbar"><b /></span><span>15 scans gratuits pour commencer</span></div>
        <Pill block icon="cam" onClick={onScan}>Scanner mon frigo</Pill>
        <button type="button" className="later" onClick={hide}>Plus tard</button>
      </div>
    </div>
    </div>
  );
}
