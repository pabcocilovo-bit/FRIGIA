// Code ami ou créateur refusé (prototype V3) : petite feuille flottante, pastille dorée, le code tapé, sans en suggérer d'autre.
import { Dialog, Pill, TextLink } from "../../ui/components";
import type { CodeVerdict } from "../../lib/codes";

export type CodeProblem = Exclude<CodeVerdict, { status: "ok" }> & { typed: string };

export function CodeSheet({ problem, onFix, onSkip }: { problem: CodeProblem | null; onFix: () => void; onSkip: () => void }) {
  const p = problem;
  const title = !p ? null : p.status === "expired" ? <>Code <em>expiré</em></> : p.status === "own" ? <>C'est <em>ton code</em></>
    : p.status === "already" ? <>Déjà un <em>code</em></> : <>Code <em>introuvable</em></>;
  const text = !p ? "" : p.status === "expired" ? `Il n'est plus valable depuis le ${p.since}.`
    : p.status === "own" ? "Ton code, c'est pour tes amis : partage-le, ils l'utilisent en s'inscrivant."
      : p.status === "already" ? `Un seul code par compte : tu as déjà utilisé ${p.code}.`
        : "Ce code ne correspond à aucun ami ni créateur. Vérifie-le avec la personne qui te l'a donné.";
  return (
    <Dialog open={!!p} onClose={onFix} icon="gift" badge="!" title={title} label="Code refusé">
      <p>{text}</p>
      {p && <span className={"cd-typed" + (p.status === "expired" ? " old" : "")}>{p.typed}</span>}
      <Pill block onClick={onFix}>Corriger le code</Pill>
      <TextLink onClick={onSkip}>Continuer sans code</TextLink>
    </Dialog>
  );
}
