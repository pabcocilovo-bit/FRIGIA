// La recette en cours, hors de l'app mobile (demandé par Hugo le 12 novembre, « comme Uber Eats ») :
// - le minuteur sonne même app fermée ou téléphone verrouillé (une notification programmée dans le téléphone) ;
// - iPhone : l'étape et le minuteur sur l'écran verrouillé et dans la Dynamic Island (Activité en direct,
//   ios/App/App/LiveCooking.swift et ios/App/FrigiaLive/FrigiaLive.swift) ;
// - Android : une notification qui reste, avec l'étape et l'heure de fin du minuteur.
// Tout suit la recette en cours de cooking.ts : rien à appeler depuis les écrans.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNativeApp } from "../../lib/native";
import { t } from "../../lib/i18n";
import { getCooking, onCookingChange, type Cooking } from "./cooking";

/** iPhone : l'Activité en direct (LiveCooking.swift) */
type LiveState = {
  title: string; step: number; steps: number; stepText: string;
  timerLabel?: string; timerStart?: number; timerEnd?: number; pausedLeft?: number;
};
const LiveCooking = registerPlugin<{
  update(s: LiveState): Promise<void>;
  end(): Promise<void>;
}>("LiveCooking");

const ALARM = 7001, ONGOING = 7002;
const IOS = Capacitor.getPlatform() === "ios";
const clock = (ms: number) => new Date(ms).toLocaleTimeString(t("fr-FR", "en-GB"), { hour: "2-digit", minute: "2-digit" });

/** Demande la permission d'afficher des notifications, une fois, au premier minuteur */
let allowed: boolean | null = null;
async function canNotify(): Promise<boolean> {
  if (allowed !== null) return allowed;
  let p = await LocalNotifications.checkPermissions();
  if (p.display === "prompt" || p.display === "prompt-with-rationale") p = await LocalNotifications.requestPermissions();
  allowed = p.display === "granted";
  return allowed;
}

/** Ce qui est affiché en ce moment, pour ne rien refaire quand rien ne change */
let shown = "";
let alarmAt: number | null = null;

async function sync(c: Cooking | null) {
  const tm = c?.timer ?? null;
  const key = c ? JSON.stringify([c.title, c.step, c.steps, c.stepText, tm?.label, tm?.end, tm?.left]) : "";
  if (key === shown) return;
  shown = key;

  // ── L'alarme du minuteur : programmée à l'heure de fin, annulée s'il s'arrête ou change ──
  const end = tm?.end ?? null;
  if (end !== alarmAt) {
    if (alarmAt !== null) await LocalNotifications.cancel({ notifications: [{ id: ALARM }] }).catch(() => undefined);
    alarmAt = null;
    if (c && tm && end && end > Date.now() + 1000 && await canNotify()) {
      await LocalNotifications.schedule({ notifications: [{
        id: ALARM, title: t("Minuteur terminé", "Timer done"), body: `${tm.label} · ${c.title}`,
        schedule: { at: new Date(end), allowWhileIdle: true }, channelId: "minuteur",
        extra: { cooking: true },
      }] }).then(() => { alarmAt = end; }).catch(() => undefined);
    }
  }

  // ── iPhone : l'Activité en direct ──
  if (IOS) {
    if (!c) { await LiveCooking.end().catch(() => undefined); return; }
    await LiveCooking.update({
      title: c.title, step: c.step + 1, steps: c.steps, stepText: c.stepText ?? "",
      timerLabel: tm?.label,
      timerStart: tm?.end != null ? tm.end - tm.seconds * 1000 : undefined,
      timerEnd: tm?.end ?? undefined,
      pausedLeft: tm && tm.end == null ? tm.left : undefined,
    }).catch(() => undefined);
    return;
  }

  // ── Android : la notification qui reste pendant la recette ──
  await LocalNotifications.cancel({ notifications: [{ id: ONGOING }] }).catch(() => undefined);
  if (!c || !await canNotify()) return;
  const timerLine = tm ? (tm.end != null ? t(`${tm.label} : prêt à ${clock(tm.end)}`, `${tm.label}: ready at ${clock(tm.end)}`) : t(`${tm.label} : en pause`, `${tm.label}: paused`)) : null;
  await LocalNotifications.schedule({ notifications: [{
    id: ONGOING, channelId: "cuisine", ongoing: true, autoCancel: false,
    title: t(`Étape ${c.step + 1} sur ${c.steps} · ${c.title}`, `Step ${c.step + 1} of ${c.steps} · ${c.title}`),
    body: [timerLine, c.stepText].filter(Boolean).join("\n"),
    largeBody: [timerLine, c.stepText].filter(Boolean).join("\n"),
    extra: { cooking: true },
  }] }).catch(() => undefined);
}

/** À appeler une fois, au démarrage de l'app mobile */
export function listenNativeCooking() {
  if (!isNativeApp) return;
  // Android : deux canaux, la recette sans bruit, le minuteur qui sonne
  if (!IOS) {
    void LocalNotifications.createChannel({ id: "cuisine", name: t("Recette en cours", "Recipe in progress"), importance: 2, visibility: 1, vibration: false }).catch(() => undefined);
    void LocalNotifications.createChannel({ id: "minuteur", name: t("Minuteurs", "Timers"), importance: 5, visibility: 1, vibration: true }).catch(() => undefined);
  }
  // Toucher la notif, l'écran verrouillé ou la Dynamic Island : retour au mode cuisine (CookingLive.tsx)
  const open = () => window.dispatchEvent(new Event("frigia-open-cooking"));
  void LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
    if ((notification.extra as { cooking?: boolean } | undefined)?.cooking) open();
  });
  void NativeApp.addListener("appUrlOpen", ({ url }) => { if (url.startsWith("fr.frigia.app://cuisine")) open(); });

  // Une seule mise à jour à la fois, dans l'ordre
  let queue = Promise.resolve();
  const run = () => { queue = queue.then(() => sync(getCooking())).catch(() => undefined); };
  onCookingChange(run);
  run();
}
