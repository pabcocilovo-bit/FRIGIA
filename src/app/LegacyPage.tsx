// Page de passage : un ancien écran (scan, historique, favoris) avec un en-tête du nouveau design.
// Ces écrans seront refaits aux étapes 6 et 7 ; d'ici là ils restent utilisables.
import type { ReactNode } from "react";
import { RoundButton } from "../ui/components";
import { useBack } from "./nav";
import "./shell.css";

export function LegacyPage({ title, children }: { title: ReactNode; children: ReactNode }) {
  const back = useBack();
  return (
    <>
      <header className="fa legacy-head">
        <span><RoundButton icon="back" label="Retour" big onClick={back} /></span>
        <h1>{title}</h1>
      </header>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "8px 16px 40px" }}>{children}</div>
    </>
  );
}
