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
import "../library/library.css";
import "./settings.css";

type Act = "paywall" | "sub" | "privacy" | "install";
type Q = { k: string; q: string; a: string; act?: [string, Act] };
const FAQ: { title: string; icon: IconName; qs: Q[] }[] = [
  { title: "Le scan", icon: "cam", qs: [
    { k: "photo", q: "Comment réussir la photo du frigo ?", a: "Porte grande ouverte, lumière allumée, et un pas en arrière pour tout faire tenir dans le cadre. Avant les recettes, tu vérifies ce que Frigia a trouvé : tu ajoutes un oubli ou tu retires une erreur." },
    { k: "free", q: "Combien de scans j'ai sans payer ?", a: "15 scans offerts, sans carte bancaire et sans limite de temps. Avec Frigia Plus, les scans sont illimités." },
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
    { k: "family", q: "Comment ajouter ma famille ?", a: "Avec Plus, dans l'onglet Famille : un prénom, un âge, ses allergies et ce qu'il n'aime pas. Les recettes s'adaptent à toute la tablée." },
    { k: "notifs", q: "Je ne reçois pas les notifications", a: "Sur iPhone, elles n'arrivent que si Frigia est sur ton écran d'accueil (iOS 16.4 ou plus). Vérifie ensuite les réglages du téléphone, puis dans Frigia : Réglages, Notifications.", act: ["Comment l'y mettre", "install"] },
    { k: "install", q: "Comment mettre Frigia sur mon écran d'accueil ?", a: "Sur iPhone, dans Safari : Partager, puis « Sur l'écran d'accueil ». Sur Android, dans Chrome : le menu ⋮, puis « Installer l'application »." },
    { k: "delete", q: "Comment supprimer mon compte ?", a: "Réglages, tout en bas : « Supprimer mon compte ». Tes scans, tes favoris et ta famille sont effacés." },
  ] },
];
const CARDS: { k: string; tone: string; art: string; title: string }[] = [
  { k: "photo", tone: "sage", art: ART_PHOTO, title: "Réussir la photo du frigo" },
  { k: "allergies", tone: "gold", art: ART_ALLERGIES, title: "Les allergies de la famille" },
  { k: "offline", tone: "cream", art: ART_OFFLINE, title: "Frigia sans réseau" },
];
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Help({ user, isPlus }: { user: User; isPlus: boolean }) {
  const back = useBack();
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const location = useLocation();
  const asked = (location.state as { q?: string } | null)?.q ?? null;
  const [open, setOpen] = useState<string | null>(asked);
  const [q, setQ] = useState("");
  const [send, setSend] = useState<SendMode | null>(null);
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
    <div className="fa fa-app hp-page" aria-label="Aide et questions fréquentes">
      <ScreenHeader title={<>Comment on peut <em>t'aider ?</em></>} left={<RoundButton icon="back" label="Retour" big onClick={back} />} />
      <div className="st-body hp-body">
        <div className="st-card hp-top">
          {([["contact", "msg", "Nous écrire", "Une vraie personne, sous 24 h"], ["bug", "alert", "Signaler un problème", "Un bug, une erreur de scan"], ["idea", "sparkle", "Donner ton avis", "Une idée pour Frigia ?"]] as const).map(([m, icon, t, s]) => (
            <button key={m} type="button" className="st-row" onClick={() => setSend(m)}>
              <span className="pi"><Icon name={icon} /></span><span className="hp-rt"><b>{t}</b><small>{s}</small></span><Icon name="next" className="st-chev" />
            </button>
          ))}
        </div>
        <span className="st-sec">Bien démarrer</span>
        <div className="hp-cards">
          {CARDS.map(c => (
            <button key={c.k} type="button" className={`hp-card ${c.tone}`} onClick={() => { setQ(""); show(c.k); }}>
              <span className="hp-art" dangerouslySetInnerHTML={{ __html: c.art }} /><b>{c.title}</b>
            </button>
          ))}
        </div>
        <h3 className="hp-faqt">Questions <em>fréquentes</em></h3>
        <label className="fv-search hp-search"><Icon name="search" /><input type="search" placeholder="Cherche une question" autoComplete="off" aria-label="Chercher dans les questions" value={q} onChange={e => setQ(e.target.value)} /></label>
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
        {!groups.length && <p className="hp-none">Rien trouvé pour « <b>{q.trim()}</b> ». Écris-nous, on te répond sous 24 h.</p>}
        <div className="hp-more">
          <h3>Pas trouvé ta <em>réponse ?</em></h3>
          <p>Écris-nous, une vraie personne te répond par email sous 24 h.</p>
          <Pill tone="cream" icon="msg" onClick={() => setSend("contact")}>Nous écrire</Pill>
        </div>
      </div>
      <ContactSheet mode={send} onClose={() => setSend(null)} user={user} />
    </div>
  );
}
