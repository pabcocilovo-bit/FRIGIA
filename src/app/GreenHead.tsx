// V3 (maquettes de Hugo, 25 octobre) : l'en-tête vert des pages, le titre en italique au milieu, la flèche retour à gauche.
// La page passe dessous avec ses coins arrondis (.v3-body).
import type { ReactNode } from "react";
import { Icon } from "../ui/components";
import { useBack } from "./nav";

export function GreenHead({ title, sub, back = true, right, children }: {
  title: ReactNode; sub?: ReactNode; back?: boolean; right?: ReactNode; children?: ReactNode;
}) {
  const goBack = useBack();
  return (
    <header className="v3head">
      <div className="v3head-row">
        {back ? <button type="button" className="v3head-back" aria-label="Retour" onClick={goBack}><Icon name="back" /></button> : <span />}
        <h1>{title}</h1>
        {right ?? <span />}
      </div>
      {sub && <p>{sub}</p>}
      {children}
    </header>
  );
}
