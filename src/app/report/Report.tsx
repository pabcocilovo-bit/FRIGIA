// 25 · Ton bilan (prototype V3, Plus) : ce que tu as sauvé ce mois-ci, comparé au mois d'avant, sur trois mois,
// avec le compteur de la communauté, le détail du calcul et ce qui a le plus servi. On remonte jusqu'à un an.
// Pas de « Restes réutilisés » : un repas de restes ne passe pas par « J'ai cuisiné ça », on ne sait pas le compter.
import { useEffect, useState } from "react";
import type { CookedMeal } from "../../lib/cooked";
import { Icon, Pill, RoundButton, ScreenHeader } from "../../ui/components";
import { useBack } from "../nav";
import { showToast } from "../toast";
import { kilos } from "../scan/savings";
import { shareStory, storyImage } from "../scan/story";
import { cmFmt, useCommunity } from "./community";
import { eur, eurShort, mealsOf, report } from "./report";
import "../library/library.css";
import "../settings/settings.css";
import "./report.css";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Le compteur monte de 97 % à sa valeur en arrivant sur l'écran */
function useCountUp(target: number | null) {
  const [v, setV] = useState<number | null>(target == null ? null : target * 0.97);
  useEffect(() => {
    if (target == null) return;
    let raf = 0, t0 = 0;
    const from = target * 0.97;
    const step = (ts: number) => {
      t0 ||= ts;
      const k = Math.min(1, (ts - t0) / 1100);
      setV(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export function Report({ meals }: { meals: CookedMeal[] }) {
  const back = useBack();
  // ?mois=2026-09 : ouvert depuis « Ton bilan de septembre est prêt »
  const [off, setOff] = useState(() => {
    const m = new URLSearchParams(window.location.search).get("mois")?.match(/^(\d{4})-(\d{2})$/);
    const d = new Date();
    return m ? Math.max(0, (d.getFullYear() - Number(m[1])) * 12 + d.getMonth() + 1 - Number(m[2])) : 0;
  });
  const community = useCommunity();
  const shown = useCountUp(community?.kg ?? null);
  const r = report(meals, off);
  const { sum, mode } = r;
  const now = r.off === 0;
  const saved = mode === "saved";
  const when = now ? "ce mois-ci" : `en ${r.name}`;
  const [whole, cents] = eur(sum.eur).split(",");

  // Graphique : la barre la plus haute (ou la projection) à 88 % de la hauteur, pour garder la place des étiquettes
  const mx = Math.max(...r.chart.map(b => b.eur), r.proj ?? 0) / 0.88 || 1;
  const pct = (n: number) => Math.round((n / mx) * 100);

  const share = async () => {
    const m = mealsOf(meals, new Date(), r.off).find(x => x.image);
    const badge = saved ? `${eur(sum.eur)} sauvés en ${r.name}` : `${kilos(sum.kg)} de mon frigo cuisinés en ${r.name}`;
    const title = saved ? `${kilos(sum.kg)} de nourriture en moins à la poubelle` : `${sum.meals} repas avec ce que j'avais`;
    const blob = await storyImage(m?.image ?? null, badge, title, "Mon bilan du mois avec Frigia · frigia.fr");
    if (!blob) { showToast("La carte n'a pas pu être créée"); return; }
    const res = await shareStory(blob, "Mon bilan Frigia", false);
    if (res === "saved") showToast("Carte enregistrée : partage-la où tu veux");
  };

  return (
    <div className="fa fa-app rp-page" aria-label="Ton bilan du mois">
      <ScreenHeader title={<>Ton <em>bilan</em></>}
        left={<RoundButton icon="back" label="Retour" big onClick={back} />}
        right={<RoundButton icon="share" label="Partager mon bilan" big onClick={() => void share()} />}>
        <div className="rp-month">
          <button type="button" aria-label="Mois précédent" disabled={r.off >= r.months - 1} onClick={() => setOff(r.off + 1)}><Icon name="back" /></button>
          <b aria-live="polite">{cap(r.name)}</b>
          <button type="button" aria-label="Mois suivant" disabled={now} onClick={() => setOff(r.off - 1)}><Icon name="next" /></button>
        </div>
      </ScreenHeader>

      <div className="rp-body">
        <div className="rp-hero">
          <span className="label">{saved ? `Sauvés ${when}` : `De ton frigo, ${when}`}</span>
          <div className="rp-tot">{whole}<small>,{cents}</small></div>
          {r.cmp && (
            <span className={"rp-cmp" + (r.cmp.diff < 0 ? " down" : "")}><Icon name="arrow" />
              <span>{r.cmp.diff === 0 ? `Autant qu'${r.cmp.vs}` : `${eur(Math.abs(r.cmp.diff))} de ${r.cmp.diff > 0 ? "plus" : "moins"} qu'${r.cmp.vs}`}</span></span>
          )}
          {r.chart.length > 1 && (
            <div className="rp-chart" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${r.chart.length},1fr)` }}>
              {r.chart.map(b => {
                const h = pct(b.eur), on = b.off === r.off, ph = on && r.proj ? pct(r.proj - b.eur) / Math.max(h, 1) * 100 : 0;
                return (
                  <div key={b.off} className={"rp-col" + (on ? " on" : "")} onClick={() => setOff(b.off)}>
                    <span className="rp-bar" style={{ height: `${h}%` }}>
                      {ph > 0 && <><span className="rp-proj-bar" style={{ height: `${ph}%` }} /><em className="rp-pl" style={{ bottom: `calc(100% + ${ph}% + 4px)` }}>≈ {r.proj} €</em></>}
                      <i>{eurShort(b.eur)}</i>
                    </span>
                    <small>{b.label}</small>
                  </div>
                );
              })}
              {r.avg != null && <span className="rp-avg" style={{ bottom: `calc(26px + ${r.avg / mx} * (100% - 26px))` }}><span>moyenne {eurShort(r.avg)}</span></span>}
            </div>
          )}
          {r.proj != null && <p className="rp-proj">En pointillé : à ce rythme, environ {r.proj} € fin {r.name}.</p>}
        </div>

        <div className="rp-tiles">
          {saved
            ? <div className="rp-tile"><span className="label">À la poubelle</span><b>{sum.kg > 0 ? "−" : ""}{kilos(sum.kg)}</b><span>de nourriture en moins</span></div>
            : <div className="rp-tile"><span className="label">De ton frigo</span><b>{kilos(sum.kg)}</b><span>de produits frais cuisinés</span></div>}
          <div className="rp-tile"><span className="label">Repas</span><b>{sum.meals}</b><span>cuisinés avec ton frigo</span></div>
        </div>

        {community && (
          <div className="cm-card">
            <svg className="cm-art" viewBox="0 0 120 120" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="60" cy="60" r="44" fill="rgba(247,241,230,.08)" stroke="rgba(247,241,230,.35)" strokeWidth="2" />
              <path d="M16 60h88M60 16c14 14 14 74 0 88M60 16c-14 14-14 74 0 88" stroke="rgba(247,241,230,.25)" strokeWidth="2" />
              <g className="cm-dots" fill="#E0A44A"><circle cx="38" cy="40" r="4" /><circle cx="78" cy="34" r="3" /><circle cx="86" cy="66" r="4" /><circle cx="50" cy="78" r="3" /><circle cx="66" cy="56" r="5" fill="#F7F1E6" /></g>
            </svg>
            <span className="label">La communauté Frigia</span>
            <div className="cm-big"><b className="cmN">{cmFmt(shown ?? community.kg)}</b><small>kg</small></div>
            <p>sauvés de la poubelle depuis le lancement, par <b>{cmFmt(community.households)}</b> foyer{community.households > 1 ? "s" : ""}.</p>
            {saved && sum.kg > 0 && <span className="cm-you"><Icon name="heart-f" /><span>Ta part : <b>{kilos(sum.kg)}</b> {when}</span></span>}
          </div>
        )}

        {saved && <>
          <span className="st-sec">Comment on compte</span>
          <div className="st-card rp-calc">
            {sum.ingredients != null && <div className="rp-row"><span className="pi"><Icon name="leaf" /></span><span>Ingrédients sauvés</span><b>{sum.ingredients}</b></div>}
            <div className="rp-row"><span className="pi"><Icon name="cart" /></span><span>Courses évitées</span><b>{eur(sum.eur)}</b></div>
            <div className="rp-row rp-sum"><span>Sauvés {when}</span><b>{eur(sum.eur)}</b></div>
          </div>
        </>}

        {sum.top.length > 0 && <>
          <span className="st-sec">Ce qui a le plus servi</span>
          <div className="st-card rp-top">
            {sum.top.map(t => (
              <div key={t.name} className="rp-ti">
                <div><b>{t.name}</b><span>{t.n} fois · {eur(t.eur)}</span></div>
                <i><u style={{ width: `${Math.round((t.n / sum.top[0].n) * 100)}%` }} /></i>
              </div>
            ))}
          </div>
        </>}

        <p className="rp-note">{saved
          ? "Estimations à partir de prix moyens en supermarché : ce que tu aurais sans doute jeté, puis racheté. Seul ce que tu as marqué « À finir » au scan compte."
          : "Rien n'est encore compté comme sauvé : marque « À finir » au scan ce qui doit partir vite. Estimations à partir de prix moyens en supermarché."}</p>
        <Pill block icon="share" onClick={() => void share()}>Partager mon bilan</Pill>
      </div>
    </div>
  );
}
