// Notifications (étape 12, migration 20261021000000_notifications.sql) : le centre de notifications et l'envoi sur les téléphones (Web Push).
// Clés VAPID dans Vercel : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys). Sans elles : le centre marche, rien ne sonne.
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { errorMessage } from "./_shared.js";

export type NotifKind = "evening" | "week" | "referral" | "scans" | "report" | "welcome";
export type Notif = {
  kind: NotifKind; title: string; body: string;
  /** L'écran qui s'ouvre, et le bouton de la notif dans le centre */
  url?: string; action?: string;
  /** Une seule notif par clé et par compte */
  key: string;
};
export type Sub = { endpoint: string; p256dh: string; auth: string };
/** Ce que reçoit le service worker (public/push-sw.js) */
export type PushPayload = { title: string; body: string; url: string; tag: string };

let ready: boolean | null = null;
function vapid(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  ready = !!(pub && priv);
  if (pub && priv) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@frigia.fr", pub, priv);
  return ready;
}
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

/** La notif, avec son id pour la marquer lue en l'ouvrant */
export const payloadOf = (n: Notif, id?: string): PushPayload => {
  const url = n.url || "/notifications";
  return { title: n.title, body: n.body, url: id ? `${url}${url.includes("?") ? "&" : "?"}notif=${id}` : url, tag: n.kind };
};

/** Envoie sur ces téléphones. Un téléphone qui ne répond plus (désabonné, appli supprimée) est retiré. */
export async function sendPush(admin: SupabaseClient, subs: Sub[], payload: PushPayload): Promise<number> {
  if (!subs.length || !vapid()) return 0;
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 6 * 3600, urgency: "normal" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      else console.error("push failed:", code, errorMessage(e));
    }
  }));
  return sent;
}

export async function subsOf(admin: SupabaseClient, userId: string): Promise<Sub[]> {
  const { data } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  return (data ?? []) as Sub[];
}

const rowOf = (userId: string, n: Notif) => ({ user_id: userId, kind: n.kind, title: n.title, body: n.body, url: n.url ?? null, action: n.action ?? null, key: n.key });

/**
 * Met des notifs dans les centres (une seule fois par clé) et envoie sur les téléphones celles qui sont nouvelles.
 * subs : les téléphones de chaque compte (absent : ceux du compte sont relus). Renvoie le nombre de notifs nouvelles.
 */
export async function notifyMany(admin: SupabaseClient, list: { userId: string; n: Notif; push: boolean }[], subs?: Map<string, Sub[]>): Promise<number> {
  if (!list.length) return 0;
  const { data, error } = await admin.from("notifications")
    .upsert(list.map(x => rowOf(x.userId, x.n)), { onConflict: "user_id,key", ignoreDuplicates: true })
    .select("id, user_id, key");
  if (error) { console.error("notifications insert failed:", error.message); return 0; }
  const added = (data ?? []) as { id: string; user_id: string; key: string }[];
  const sends = added.map(row => async () => {
    const x = list.find(l => l.userId === row.user_id && l.n.key === row.key);
    if (!x?.push) return;
    await sendPush(admin, subs ? subs.get(row.user_id) ?? [] : await subsOf(admin, row.user_id), payloadOf(x.n, row.id));
  });
  // Par paquets de 20, pour ne pas ouvrir des centaines de connexions d'un coup
  for (let i = 0; i < sends.length; i += 20) await Promise.all(sends.slice(i, i + 20).map(f => f()));
  return added.length;
}

/** Une notif pour un compte. Ne lève jamais : une notif ratée ne doit pas casser un paiement ou un scan. */
export async function notify(admin: SupabaseClient, userId: string, n: Notif, push = true): Promise<void> {
  try { await notifyMany(admin, [{ userId, n, push }]); } catch (e) { console.error("notify failed:", errorMessage(e)); }
}
