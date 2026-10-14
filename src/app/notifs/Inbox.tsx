// 16 bis · Centre de notifications (prototype V3) : la cloche de l'accueil l'ouvre. Non lues en doré, rangées par
// Aujourd'hui / Cette semaine / Plus tôt, triées Repas ou Ton compte. Glisser vers la gauche supprime.
// Si ce téléphone ne sonne pas, un bandeau propose de les activer.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { markRead, pushState, refreshNotifs, removeNotif, useNotifs, type Notif, type NotifKind, type PushState } from "../../lib/notify";
import type { HistoryEntry } from "../../lib/types";
import type { IconName } from "../../ui/icons";
import { EmptyState, Icon, Pill, RoundButton, ScreenHeader } from "../../ui/components";
import { LOGO_SYMBOL } from "../logo";
import { useBack } from "../nav";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import "../library/library.css";
import "./notifs.css";

const KIND: Record<NotifKind, { label: string; cat: "meal" | "acc"; icon: IconName; gold?: boolean }> = {
  evening: { label: "L'idée du soir", cat: "meal", icon: "pot" },
  week: { label: "Ta semaine", cat: "meal", icon: "cal" },
  list: { label: "Courses", cat: "meal", icon: "cart" },
  referral: { label: "Parrainage", cat: "acc", icon: "gift", gold: true },
  scans: { label: "Tes scans", cat: "acc", icon: "sparkle", gold: true },
  report: { label: "Ton bilan", cat: "acc", icon: "leaf" },
  welcome: { label: "Frigia", cat: "acc", icon: "home" },
};
const DAY = 864e5;
const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long" });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** « 18 h 02 », « dimanche », « 1er octobre » */
function when(d: Date, now = new Date()) {
  const ago = startOfDay(now) - startOfDay(d);
  if (ago <= 0) return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
  if (ago < 7 * DAY) return WEEKDAY.format(d);
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTH.format(d)}`;
}
function groupOf(d: Date, now = new Date()) {
  const ago = startOfDay(now) - startOfDay(d);
  return ago <= 0 ? "Aujourd'hui" : ago < 7 * DAY ? "Cette semaine" : "Plus tôt";
}

/** L'idée du soir : la photo du plat, retrouvée dans le scan */
function MealPhoto({ url, history }: { url: string | null; history: HistoryEntry[] }) {
  const m = url?.match(/^\/recettes\/([^/?]+)\/(\d+)/);
  const recipe = m ? history.find(e => e.id === decodeURIComponent(m[1]))?.recipes[Number(m[2])] : undefined;
  const photo = useRecipePhoto(recipe?.title, recipe?.imageSearch);
  return photo ? <span className="ib-ic photo"><img src={photo} alt="" /></span> : <span className="ib-ic"><Icon name="pot" /></span>;
}

function Card({ n, name, history, onOpen }: { n: Notif; name: string; history: HistoryEntry[]; onOpen: (n: Notif, viaAction: boolean) => void }) {
  const k = KIND[n.kind] ?? KIND.welcome;
  const it = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef({ x0: 0, y0: 0, dx: 0, on: false, lock: null as "x" | "y" | null, moved: false });
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);

  const remove = () => {
    const el = it.current;
    if (el) { el.style.height = el.offsetHeight + "px"; void el.offsetWidth; el.style.height = "0px"; el.style.marginBottom = "-8px"; }
    setGone(true);
    setTimeout(() => removeNotif(n.id), 300);
    showToast("Notification supprimée");
  };
  const down = (e: React.PointerEvent) => {
    if (e.button) return;
    drag.current = { x0: e.clientX, y0: e.clientY, dx: 0, on: true, lock: null, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.on) return;
    const mx = e.clientX - d.x0, my = e.clientY - d.y0;
    if (d.lock === null && (Math.abs(mx) > 6 || Math.abs(my) > 6)) {
      d.lock = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (d.lock === "x") { setDragging(true); try { card.current?.setPointerCapture(e.pointerId); } catch { /* déjà relâché */ } }
    }
    if (d.lock !== "x") return;
    d.dx = Math.min(0, mx);
    setDx(d.dx);
  };
  const up = () => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    setDragging(false);
    if (d.lock === "x") {
      d.moved = true;
      setTimeout(() => { d.moved = false; }, 50);
      if (d.dx < -90) { setDx(-(card.current?.offsetWidth ?? 400) * 1.1); remove(); return; }
    }
    setDx(0);
  };
  const click = (e: React.MouseEvent) => {
    if (drag.current.moved) return;
    onOpen(n, !!(e.target as HTMLElement).closest(".ib-act"));
  };

  const icon = n.kind === "evening" ? <MealPhoto url={n.url} history={history} />
    : n.kind === "welcome" ? <span className="ib-ic logo"><span className="fg-tile ib-tile" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL }} /></span>
    : <span className={"ib-ic" + (k.gold ? " gold" : "")}><Icon name={k.icon} /></span>;
  return (
    <div ref={it} className={"ib-it" + (n.read ? "" : " new") + (gone ? " gone" : "")}>
      <div className="ib-del" aria-hidden="true"><Icon name="trash" />Supprimer</div>
      <div ref={card} className={"ib-card" + (dragging ? " drag" : "")} style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click}>
        {icon}
        <div className="ib-tx">
          <span className="ib-k">{k.label} · {when(n.date)}</span>
          <b>{n.kind === "welcome" ? `Bienvenue, ${name}` : n.title}</b>
          {n.body && <p>{n.body}</p>}
          {n.action && n.url && <button type="button" className="pill ib-act">{n.action}</button>}
        </div>
        <i className="ib-dot" aria-label={n.read ? undefined : "Non lue"} />
      </div>
    </div>
  );
}

export function Inbox({ userId, name, isPlus, history }: { userId: string; name: string; isPlus: boolean; history: HistoryEntry[] }) {
  const back = useBack();
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const all = useNotifs();
  const [tab, setTab] = useState<"" | "meal" | "acc">("");
  const [push, setPush] = useState<PushState | null>(null);
  useEffect(() => { void refreshNotifs(userId); void pushState().then(setPush); }, [userId]);

  // « Il te reste 3 scans » ne concerne plus un compte Plus
  const mine = (all ?? []).filter(n => !(isPlus && n.kind === "scans"));
  const shown = mine.filter(n => !tab || (KIND[n.kind] ?? KIND.welcome).cat === tab);
  const unread = shown.filter(n => !n.read);
  const groups = ["Aujourd'hui", "Cette semaine", "Plus tôt"].map(g => ({ g, items: shown.filter(n => groupOf(n.date) === g) })).filter(x => x.items.length);

  const open = (n: Notif, viaAction: boolean) => {
    markRead([n.id]);
    // Comme la maquette : une notif avec un bouton s'ouvre par son bouton
    if (!n.url || (n.action && !viaAction)) return;
    const lock = n.url.startsWith("/planning") ? "planning" : n.url.startsWith("/bilan") ? "bilan" : null;
    if (lock && !isPlus) openPaywall(lock, n.url); else navigate(n.url);
  };

  return (
    <div className="fa fa-app ib-page" aria-label="Tes notifications">
      <ScreenHeader title={<>Tes <em>notifs</em></>}
        sub={unread.length ? `${unread.length} non lue${unread.length > 1 ? "s" : ""}` : "Tout est lu"}
        left={<RoundButton icon="back" label="Retour" big onClick={back} />}
        right={<button type="button" className="ib-all" disabled={!unread.length} onClick={() => { markRead(unread.map(n => n.id)); showToast("Tout est marqué comme lu"); }}>Tout marquer lu</button>}>
        <div className="hs-tabs" role="tablist">
          {([["", "Tout"], ["meal", "Repas"], ["acc", "Ton compte"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : undefined} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
      </ScreenHeader>
      <div className="ib-body">
        {push && push !== "on" && (
          <div className="ib-off">
            <span className="ib-ic"><Icon name="bell" /></span>
            <div><b>Coupées sur ce téléphone</b><span>Elles arrivent ici, mais ton téléphone ne sonne pas.</span></div>
            <Pill onClick={() => navigate("/notifications/activer")}>Activer</Pill>
          </div>
        )}
        {groups.map(({ g, items }) => (
          <div key={g} className="ib-grp"><h3 className="ib-day">{g}</h3>
            {items.map(n => <Card key={n.id} n={n} name={name} history={history} onOpen={open} />)}
          </div>
        ))}
        {all && !groups.length && (
          <EmptyState title={<>Rien de <em>nouveau</em></>}
            text="On te prévient quand l'idée du soir est prête, ou quand un ami s'abonne avec ton lien."
            art={
              <svg className="es-art" viewBox="0 0 200 130" aria-hidden="true" fill="none" stroke="#34503B" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
                <path d="M72 86c5-5 8-12 8-28a20 20 0 0 1 40 0c0 16 3 23 8 28z" fill="#FBF7EF" />
                <path d="M66 90h68" /><path d="M92 100a8 8 0 0 0 16 0" /><path d="M100 30v-6" />
                <path d="M88 52c1-5 4-8 8-9" stroke="#9FCCA4" strokeWidth="3.5" />
                <path d="M152 40l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#E0A44A" stroke="none" />
                <circle cx="46" cy="58" r="3.5" fill="#E0A44A" stroke="none" />
                <path d="M28 118h6M42 118h8M58 118h114" strokeWidth="3" />
              </svg>
            } />
        )}
        {groups.length > 0 && <p className="ib-hint"><Icon name="back" />Glisse une notification vers la gauche pour la supprimer</p>}
      </div>
    </div>
  );
}
