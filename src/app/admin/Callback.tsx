// Retour de TikTok après « Connecter TikTok » (dashboard > Réseaux) : /admin?code=…&state=…
// Ouvert par l'admin ou par un créateur (sans compte Frigia) : le serveur vérifie le state signé (api/_tiktok.ts).
import { useEffect, useState } from "react";
import { socialConnect } from "./admin";
import "./admin.css";

type Result = { status: "wait" } | { status: "ok"; handle: string; kind: string } | { status: "error"; message: string };

// Le code ne sert qu'une fois : une seule demande, même si React lance l'effet deux fois
let pending: ReturnType<typeof socialConnect> | null = null;

/** Ce que TikTok a mis dans l'adresse, lu une fois (puis retiré de l'adresse) */
function readReturn(): { code: string; state: string } | { error: string } {
  const q = new URLSearchParams(location.search);
  history.replaceState(null, "", "/admin");
  const code = q.get("code"), state = q.get("state");
  if (q.get("error") || !code || !state) {
    return { error: q.get("error") === "access_denied" ? "Tu as refusé l'autorisation : rien n'a été relié." : "TikTok n'a pas donné l'autorisation." };
  }
  return { code, state };
}

export default function Callback({ admin }: { admin: boolean }) {
  const [ret] = useState(readReturn);
  const [res, setRes] = useState<Result>(() => ("error" in ret ? { status: "error", message: ret.error } : { status: "wait" }));
  useEffect(() => {
    if ("error" in ret) return;
    let live = true;
    pending ??= socialConnect(ret.code, ret.state);
    void pending.then(r => { if (live) setRes("error" in r ? { status: "error", message: r.error } : { status: "ok", ...r }); });
    return () => { live = false; };
  }, [ret]);

  return (
    <div className="adm adm-center">
      <div className="adm-card adm-msg">
        <div className="adm-brand">Frigia</div>
        {res.status === "wait" && <p className="adm-muted">Liaison avec TikTok…</p>}
        {res.status === "ok" && <>
          <h1>C'est relié</h1>
          <p>Le compte TikTok <b>@{res.handle}</b> est relié à Frigia. Frigia lit seulement tes chiffres publics (abonnés, j'aime, vues) et ne publie jamais rien.</p>
          {!admin && <p className="adm-muted">Merci ! Tu peux fermer cette page.</p>}
        </>}
        {res.status === "error" && <>
          <h1>Ça n'a pas marché</h1>
          <p>{res.message}</p>
        </>}
        {admin && res.status !== "wait" && <div className="adm-row"><a className="adm-btn" href="/admin">Ouvrir le dashboard</a></div>}
      </div>
    </div>
  );
}
