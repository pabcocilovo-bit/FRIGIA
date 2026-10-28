// Réglages, rubrique Notifications (prototype V3) : « Coupées sur ce téléphone » tant qu'il ne sonne pas, puis trois interrupteurs.
// « Nouveautés par email » est gardé ; les emails ne partent pas encore (voir le doc des points à traiter).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { DEFAULT_SETTINGS, fetchNotifSettings, pushState, saveNotifSettings, type NotifSettings, type PushState } from "../../lib/notify";
import { Icon, Pill } from "../../ui/components";
import { showToast } from "../toast";
import "./notifs.css";

const ROWS: { k: keyof NotifSettings; title: string; sub: string; on: string; off: string }[] = [
  { k: "evening", title: "L'idée du soir", sub: "Vers 18 h, ce que ton frigo permet", on: "L'idée du soir est activée", off: "Plus d'idée du soir" },
  { k: "week", title: "Ta semaine", sub: "Le dimanche, pour la préparer", on: "Le rappel du dimanche est activé", off: "Plus de rappel le dimanche" },
  { k: "news", title: "Nouveautés par email", sub: "Une fois par mois, pas plus", on: "Tu recevras les nouveautés", off: "Plus d'email de nouveautés" },
];

export function NotifSettingsCard({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [s, setS] = useState<NotifSettings>(DEFAULT_SETTINGS);
  const [push, setPush] = useState<PushState | null>(null);
  useEffect(() => {
    void fetchNotifSettings(userId).then(v => { if (v) setS(v); });
    void pushState().then(setPush);
  }, [userId]);

  const toggle = (k: keyof NotifSettings, msg: string) => {
    const next = { ...s, [k]: !s[k] };
    setS(next);
    showToast(msg);
    void saveNotifSettings(userId, next).then(ok => {
      if (!ok) { setS(prev => ({ ...prev, [k]: !next[k] })); showToast("Pas enregistré. Réessaie dans un moment"); }
    });
  };

  return (
    <div className="st-card">
      {push && push !== "on" && (
        <div className="st-nfoff">
          <span><Icon name="bell" /></span>
          <div><b>Coupées sur ce téléphone</b><small>Rien n'arrive tant que tu ne les actives pas</small></div>
          <Pill onClick={() => navigate("/notifications/activer")}>Activer</Pill>
        </div>
      )}
      {ROWS.map(r => (
        <div key={r.k} className="st-row st-tgrow">
          <div><b>{r.title}</b><small>{r.sub}</small></div>
          <button type="button" className={"st-tg" + (s[r.k] ? " on" : "")} role="switch" aria-checked={s[r.k]} aria-label={r.title} onClick={() => toggle(r.k, s[r.k] ? r.off : r.on)}><i /></button>
        </div>
      ))}
    </div>
  );
}
