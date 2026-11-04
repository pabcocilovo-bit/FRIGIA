// 22 ter · Aide et questions fréquentes (prototype V3) : nous écrire, cartes « Bien démarrer », FAQ en rubriques.
// On peut y arriver sur une question ouverte : navigate("/aide", { state: { q: "notifs" } }).
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { User } from "../../lib/types";
import type { IconName } from "../../ui/icons";
import { Icon, Pill, RoundButton, ScreenHeader } from "../../ui/components";
import { useBack } from "../nav";
import { useOpenPaywall } from "../plus/subscription";
import { ContactSheet, type SendMode } from "./sheets";
import { ART_ALLERGIES, ART_OFFLINE, ART_PHOTO } from "./helpArt";
import { t } from "../../lib/i18n";
import "../library/library.css";
import "./settings.css";

type Act = "paywall" | "sub" | "privacy" | "install";
type Q = { k: string; q: string; a: string; act?: [string, Act] };
const FAQ: { title: string; icon: IconName; qs: Q[] }[] = t([
  { title: "Le scan", icon: "cam", qs: [
    { k: "photo", q: "Comment réussir la photo du frigo ?", a: "Porte grande ouverte, lumière allumée, et un pas en arrière pour tout faire tenir dans le cadre. Avant les recettes, tu vérifies ce que Frigia a trouvé : tu ajoutes un oubli ou tu retires une erreur." },
    { k: "free", q: "Est-ce que je peux essayer sans payer ?", a: "Oui : 7 jours pour tout essayer, sans carte bancaire. Avec un code ami ou créateur, 7 jours de plus. Ensuite, Frigia Plus coûte 6,99 € par mois ou 39,99 € par an." },
    { k: "offline", q: "Frigia marche sans réseau ?", a: "Oui pour ta liste de courses, ta semaine et tes favoris : ils sont gardés sur ton téléphone. Le scan, lui, attend le retour du réseau." },
  ] },
  { title: "Les recettes", icon: "utensils", qs: [
    { k: "allergies", q: "Frigia tient compte des allergies ?", a: "Oui, de celles que tu indiques pour toi et pour ta famille. Les recettes viennent d'une IA : vérifie quand même les étiquettes, surtout pour les enfants." },
    { k: "ai", q: "D'où viennent les recettes ?", a: "D'une intelligence artificielle (Claude, d'Anthropic) qui part de tes ingrédients, de tes goûts et du temps que tu as. Les photos des plats donnent une idée : elles ne montrent pas exactement ta recette." },
    { k: "missing", q: "Il me manque un ingrédient, je fais comment ?", a: "Sur la recette, touche « Ajouter les manquants » : ils arrivent dans ta liste de courses, rangés par rayon." },
  ] },
  { title: "L'abonnement", icon: "sparkle", qs: [
    { k: "price", q: "Combien coûte Frigia Plus ?", a: "6,99 € par mois sans engagement, ou 39,99 € par an. Les 500 premiers abonnés ont le prix fondateur : 29,99 € par an, gardé tant qu'ils ne résilient pas.", act: ["Voir Frigia Plus", "paywall"] },
    { k: "code", q: "J'ai un code ami ou créateur, où le mettre ?", a: "En créant ton compte, sous « J'ai un code ami ou créateur ». Ou au moment de passer à Plus. Un seul code par compte." },
    { k: "cancel", q: "Comment résilier ?", a: "Réglages, puis Abonnement : c'est fait en 3 clics. Plus reste actif jusqu'à la fin de la période payée. Tu peux aussi faire une pause d'un mois.", act: ["Gérer mon abonnement", "sub"] },
    { k: "declined", q: "Mon paiement est refusé, je perds tout ?", a: "Non. Rien n'est débité et rien n'est supprimé : tes favoris, tes scans et ta liste restent là. Tu changes de carte quand tu veux." },
  ] },
  { title: "Ton compte", icon: "user", qs: [
    // La maquette dit que la photo reste dans « Tes scans » : l'appli ne la garde pas
    { k: "photos", q: "Que devient la photo de mon frigo ?", a: "Elle sert seulement à lire tes ingrédients : Frigia ne la garde pas. On ne vend jamais tes données.", act: ["Lire la confidentialité", "privacy"] },
    { k: "family", q: "Comment ajouter ma famille ?", a: "Avec Plus, dans Mon profil, en haut de l'accueil : un prénom, un âge, ses allergies et ce qu'il n'aime pas. Les recettes s'adaptent à toute la tablée." },
    { k: "notifs", q: "Je ne reçois pas les notifications", a: "Sur iPhone, elles n'arrivent que si Frigia est sur ton écran d'accueil (iOS 16.4 ou plus). Vérifie ensuite les réglages du téléphone, puis dans Frigia : Réglages, Notifications.", act: ["Comment l'y mettre", "install"] },
    { k: "install", q: "Comment mettre Frigia sur mon écran d'accueil ?", a: "Sur iPhone, dans Safari : Partager, puis « Sur l'écran d'accueil ». Sur Android, dans Chrome : le menu ⋮, puis « Installer l'application »." },
    // Limite d'iOS pour les sites installés sur l'écran d'accueil ; à retirer quand Frigia sera une vraie appli
    { k: "camera", q: "Sur iPhone, Frigia me redemande la caméra à chaque fois", a: "C'est iOS qui fait ça quand Frigia est ouverte depuis l'écran d'accueil : Frigia ne peut pas l'empêcher. Pour ne plus avoir la question : Réglages de l'iPhone, Apps, Safari, Caméra, puis « Autoriser ». Attention : ce réglage vaut pour tous les sites que tu ouvres dans Safari, pas seulement Frigia, et il reste actif tant que tu ne le changes pas. Si tu préfères, laisse « Demander » : il suffit de toucher « Autoriser » à chaque scan." },
    { k: "delete", q: "Comment supprimer mon compte ?", a: "Réglages, tout en bas : « Supprimer mon compte ». Tes scans, tes favoris et ta famille sont effacés." },
  ] },
], [
  { title: "Scanning", icon: "cam", qs: [
    { k: "photo", q: "How do I take a good fridge photo?", a: "Door wide open, light on, and one step back so everything fits in the frame. Before the recipes, you check what Frigia found: add anything it missed or remove a mistake." },
    { k: "free", q: "Can I try it without paying?", a: "Yes: 7 days to try everything, no card needed. With a friend or creator code, 7 more days. After that, Frigia Plus costs €6.99 a month or €39.99 a year." },
    { k: "offline", q: "Does Frigia work offline?", a: "Yes for your shopping list, your week and your favourites: they're kept on your phone. Scanning waits until you're back online." },
  ] },
  { title: "Recipes", icon: "utensils", qs: [
    { k: "allergies", q: "Does Frigia take allergies into account?", a: "Yes, the ones you enter for yourself and your family. The recipes come from an AI: still check the labels, especially for children." },
    { k: "ai", q: "Where do the recipes come from?", a: "From an artificial intelligence (Claude, by Anthropic) that starts from your ingredients, your tastes and the time you have. The dish photos give an idea: they don't show exactly your recipe." },
    { k: "missing", q: "I'm missing an ingredient, what do I do?", a: "On the recipe, tap \"Add the missing items\": they go to your shopping list, sorted by aisle." },
  ] },
  { title: "Subscription", icon: "sparkle", qs: [
    { k: "price", q: "How much is Frigia Plus?", a: "€6.99 a month with no commitment, or €39.99 a year. The first 500 subscribers get the founder price: €29.99 a year, kept as long as they don't cancel.", act: ["See Frigia Plus", "paywall"] },
    { k: "code", q: "I have a friend or creator code, where do I enter it?", a: "When you create your account, under \"I have a friend or creator code\". Or when you upgrade to Plus. One code per account." },
    { k: "cancel", q: "How do I cancel?", a: "Settings, then Subscription: it's done in 3 taps. Plus stays active until the end of the paid period. You can also take a one-month pause.", act: ["Manage my subscription", "sub"] },
    { k: "declined", q: "My payment was declined, do I lose everything?", a: "No. Nothing is charged and nothing is deleted: your favourites, scans and list stay. Change your card whenever you like." },
  ] },
  { title: "Your account", icon: "user", qs: [
    { k: "photos", q: "What happens to my fridge photo?", a: "It's only used to read your ingredients: Frigia doesn't keep it. We never sell your data.", act: ["Read the privacy policy", "privacy"] },
    { k: "family", q: "How do I add my family?", a: "With Plus, in My profile, at the top of the home screen: a first name, an age, their allergies and what they don't like. Recipes adapt to the whole table." },
    { k: "notifs", q: "I'm not getting notifications", a: "On iPhone, they only arrive if Frigia is on your home screen (iOS 16.4 or later). Then check your phone settings, and in Frigia: Settings, Notifications.", act: ["How to add it", "install"] },
    { k: "install", q: "How do I put Frigia on my home screen?", a: "On iPhone, in Safari: Share, then \"Add to Home Screen\". On Android, in Chrome: the ⋮ menu, then \"Install app\"." },
    { k: "camera", q: "On iPhone, Frigia asks for the camera every time", a: "iOS does this when Frigia is opened from the home screen: Frigia can't prevent it. To stop the question: iPhone Settings, Apps, Safari, Camera, then \"Allow\". Note: this setting applies to every site you open in Safari, not just Frigia, and it stays on until you change it. If you prefer, leave \"Ask\": just tap \"Allow\" at each scan." },
    { k: "delete", q: "How do I delete my account?", a: "Settings, at the very bottom: \"Delete my account\". Your scans, favourites and family are erased." },
  ] },
]);

const CARDS: { k: string; tone: string; art: string; title: string }[] = [
  { k: "photo", tone: "sage", art: ART_PHOTO, title: t("Réussir la photo du frigo", "Taking a good fridge photo") },
  { k: "allergies", tone: "gold", art: ART_ALLERGIES, title: t("Les allergies de la famille", "Family allergies") },
  { k: "offline", tone: "cream", art: ART_OFFLINE, title: t("Frigia sans réseau", "Frigia offline") },
];
const norm = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Help({ user, isPlus }: { user: User; isPlus: boolean }) {
  const back = useBack();
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const location = useLocation();
  const asked = (location.state as { q?: string } | null)?.q ?? null;
  // Le bandeau alpha de l'accueil ouvre directement « Nous écrire » (state.send)
  const sendAsked = (location.state as { send?: SendMode } | null)?.send ?? null;
  const [open, setOpen] = useState<string | null>(asked);
  const [q, setQ] = useState("");
  const [send, setSend] = useState<SendMode | null>(sendAsked);
  const qRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const query = norm(q.trim());
  const groups = FAQ.map(g => ({ ...g, qs: g.qs.filter(x => !query || norm(x.q + " " + x.a).includes(query)) })).filter(g => g.qs.length);

  const show = (k: string) => {
    setOpen(k);
    setTimeout(() => qRefs.current[k]?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };
  // Arrivé sur une question : on la montre
  useEffect(() => {
    if (asked) setTimeout(() => qRefs.current[asked]?.scrollIntoView({ block: "center" }), 60);
  }, [asked]);
  const act = (a: Act) => {
    if (a === "install") show("install");
    else if (a === "paywall") openPaywall("def");
    else if (a === "sub" && isPlus) navigate("/resilier");
    else if (a === "sub") openPaywall("def");
    else navigate("/infos-legales/confidentialite");
  };

  return (
    <div className="fa fa-app hp-page" aria-label={t("Aide et questions fréquentes", "Help and FAQ")}>
      <ScreenHeader title={t(<>Comment on peut <em>t'aider ?</em></>, <>How can we <em>help?</em></>)} left={<RoundButton icon="back" label={t("Retour", "Back")} big onClick={back} />} />
      <div className="st-body hp-body">
        <div className="st-card hp-top">
          {([["contact", "msg", t("Nous écrire", "Contact us"), t("Une vraie personne, sous 24 h", "A real person, within 24 h")], ["bug", "alert", t("Signaler un problème", "Report a problem"), t("Un bug, une erreur de scan", "A bug, a scan mistake")], ["idea", "sparkle", t("Donner ton avis", "Give feedback"), t("Une idée pour Frigia ?", "An idea for Frigia?")]] as const).map(([m, icon, title, s]) => (
            <button key={m} type="button" className="st-row" onClick={() => setSend(m)}>
              <span className="pi"><Icon name={icon} /></span><span className="hp-rt"><b>{title}</b><small>{s}</small></span><Icon name="next" className="st-chev" />
            </button>
          ))}
        </div>
        <span className="st-sec">{t("Bien démarrer", "Getting started")}</span>
        <div className="hp-cards">
          {CARDS.map(c => (
            <button key={c.k} type="button" className={`hp-card ${c.tone}`} onClick={() => { setQ(""); show(c.k); }}>
              <span className="hp-art" dangerouslySetInnerHTML={{ __html: c.art }} /><b>{c.title}</b>
            </button>
          ))}
        </div>
        <h3 className="hp-faqt">{t(<>Questions <em>fréquentes</em></>, <>Frequently asked <em>questions</em></>)}</h3>
        <label className="fv-search hp-search"><Icon name="search" /><input type="search" placeholder={t("Cherche une question", "Search a question")} autoComplete="off" aria-label={t("Chercher dans les questions", "Search the questions")} value={q} onChange={e => setQ(e.target.value)} /></label>
        {groups.map(g => (
          <div key={g.title} className="hp-grp"><span className="st-sec">{g.title}</span>
            {g.qs.map(x => {
              const on = open === x.k;
              return (
                <div key={x.k} ref={el => { qRefs.current[x.k] = el; }} className={"hp-q" + (on ? " on" : "")}>
                  <button type="button" className="hp-qb" aria-expanded={on} onClick={() => setOpen(on ? null : x.k)}>
                    <span className="pi"><Icon name={g.icon} /></span><b>{x.q}</b><span className="hp-plus" aria-hidden="true" />
                  </button>
                  <div className="hp-a"><div>
                    <p>{x.a}</p>
                    {x.act && <button type="button" className="hp-act" onClick={() => act(x.act![1])}>{x.act[0]}<Icon name="next" /></button>}
                  </div></div>
                </div>
              );
            })}
          </div>
        ))}
        {!groups.length && <p className="hp-none">{t(<>Rien trouvé pour « <b>{q.trim()}</b> ». Écris-nous, on te répond sous 24 h.</>, <>Nothing found for "<b>{q.trim()}</b>". Write to us, we reply within 24 h.</>)}</p>}
        <div className="hp-more">
          <h3>{t(<>Pas trouvé ta <em>réponse ?</em></>, <>Didn't find your <em>answer?</em></>)}</h3>
          <p>{t("Écris-nous, une vraie personne te répond par email sous 24 h.", "Write to us, a real person replies by email within 24 h.")}</p>
          <Pill tone="cream" icon="msg" onClick={() => setSend("contact")}>{t("Nous écrire", "Contact us")}</Pill>
        </div>
      </div>
      <ContactSheet mode={send} onClose={() => setSend(null)} user={user} />
    </div>
  );
}
