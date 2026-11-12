// Notifications de l'app mobile (étape 3 de l'app) : iPhone par Apple (APNs), Android par Google (Firebase Cloud Messaging).
// Les jetons sont rangés dans push_subscriptions avec le web : endpoint « apns:<jeton> » ou « fcm:<jeton> » (voir api/_push.ts).
//
// Variables Vercel :
//   iPhone  : APNS_KEY (le fichier .p8, texte complet), APNS_KEY_ID, APNS_TEAM_ID. APNS_TOPIC facultatif (fr.frigia.app).
//   Android : FCM_SERVICE_ACCOUNT (le fichier JSON du compte de service Firebase, texte complet).
// Sans elles : rien ne part sur ce téléphone-là, le reste marche.
import { connect } from "node:http2";
import { createSign } from "node:crypto";
import type { PushPayload } from "./_push.js";

export type NativeResult = "sent" | "gone" | "failed" | "off";

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const pem = (s: string) => s.replace(/\\n/g, "\n");

function jwt(header: object, claims: object, key: string, alg: "ES256" | "RS256"): string {
  const head = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sign = createSign("SHA256");
  sign.update(head);
  const sig = alg === "ES256" ? sign.sign({ key: pem(key), dsaEncoding: "ieee-p1363" }) : sign.sign(pem(key));
  return `${head}.${b64url(sig)}`;
}

// ─── iPhone (APNs) ───
let apnsToken: { value: string; at: number } | null = null;
function apnsAuth(): string | null {
  const key = process.env.APNS_KEY, kid = process.env.APNS_KEY_ID, iss = process.env.APNS_TEAM_ID;
  if (!key || !kid || !iss) return null;
  // Apple veut un jeton de moins d'une heure, mais pas un neuf à chaque envoi
  if (!apnsToken || Date.now() - apnsToken.at > 40 * 60e3) {
    apnsToken = { value: jwt({ alg: "ES256", kid }, { iss, iat: Math.floor(Date.now() / 1000) }, key, "ES256"), at: Date.now() };
  }
  return apnsToken.value;
}

function apnsPost(host: string, token: string, auth: string, body: string): Promise<{ status: number; reason?: string }> {
  return new Promise(resolve => {
    const client = connect(`https://${host}`);
    client.on("error", () => resolve({ status: 0 }));
    const req = client.request({
      ":method": "POST", ":path": `/3/device/${token}`,
      authorization: `bearer ${auth}`, "apns-topic": process.env.APNS_TOPIC || "fr.frigia.app",
      "apns-push-type": "alert", "apns-priority": "10", "apns-expiration": String(Math.floor(Date.now() / 1000) + 6 * 3600),
      "content-type": "application/json",
    });
    let status = 0, data = "";
    req.on("response", h => { status = Number(h[":status"]); });
    req.on("data", c => { data += c; });
    req.on("end", () => { client.close(); let reason: string | undefined; try { reason = JSON.parse(data).reason; } catch { /* vide */ } resolve({ status, reason }); });
    req.on("error", () => { client.close(); resolve({ status: 0 }); });
    req.setTimeout(10_000, () => req.close());
    req.end(body);
  });
}

async function sendApns(token: string, p: PushPayload): Promise<NativeResult> {
  const auth = apnsAuth();
  if (!auth) return "off";
  const body = JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: "default", "thread-id": p.tag }, url: p.url });
  let r = await apnsPost("api.push.apple.com", token, auth, body);
  // Une app lancée depuis Xcode a un jeton « de test » : Apple le refuse ici, il passe par le serveur de test
  if (r.status === 400 && r.reason === "BadDeviceToken") r = await apnsPost("api.sandbox.push.apple.com", token, auth, body);
  if (r.status === 200) return "sent";
  if (r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered") return "gone";
  console.error("apns failed:", r.status, r.reason);
  return "failed";
}

// ─── Android (Firebase Cloud Messaging) ───
type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let fcmToken: { value: string; until: number } | null = null;
function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try { return JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString()) as ServiceAccount; } catch { return null; }
}
async function fcmAuth(sa: ServiceAccount): Promise<string | null> {
  if (fcmToken && Date.now() < fcmToken.until) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt({ alg: "RS256", typ: "JWT" }, {
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }, sa.private_key, "RS256");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!r.ok) { console.error("fcm auth failed:", r.status); return null; }
  const { access_token, expires_in } = await r.json() as { access_token: string; expires_in: number };
  fcmToken = { value: access_token, until: Date.now() + (expires_in - 300) * 1000 };
  return access_token;
}

async function sendFcm(token: string, p: PushPayload): Promise<NativeResult> {
  const sa = serviceAccount();
  if (!sa) return "off";
  const auth = await fcmAuth(sa);
  if (!auth) return "failed";
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token, notification: { title: p.title, body: p.body }, data: { url: p.url },
      android: { ttl: `${6 * 3600}s`, notification: { tag: p.tag, color: "#2D5E45" } },
    } }),
  });
  if (r.ok) return "sent";
  if (r.status === 404 || r.status === 400) {
    const text = await r.text();
    if (/UNREGISTERED|INVALID_ARGUMENT/.test(text) && /token/i.test(text)) return "gone";
    console.error("fcm failed:", r.status, text.slice(0, 200));
    return "failed";
  }
  console.error("fcm failed:", r.status);
  return "failed";
}

/** endpoint « apns:… » ou « fcm:… » : un téléphone de l'app. null : un navigateur (Web Push). */
export const nativeKind = (endpoint: string): "apns" | "fcm" | null =>
  endpoint.startsWith("apns:") ? "apns" : endpoint.startsWith("fcm:") ? "fcm" : null;

export function sendNative(endpoint: string, p: PushPayload): Promise<NativeResult> {
  const kind = nativeKind(endpoint), token = endpoint.slice(endpoint.indexOf(":") + 1);
  return kind === "apns" ? sendApns(token, p) : kind === "fcm" ? sendFcm(token, p) : Promise.resolve("failed");
}
