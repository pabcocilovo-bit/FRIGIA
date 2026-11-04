// Code ami ou créateur refusé (prototype V3) : petite feuille flottante, pastille dorée, le code tapé, sans en suggérer d'autre.
import { Dialog, Pill, TextLink } from "../../ui/components";
import type { CodeVerdict } from "../../lib/codes";
import { t } from "../../lib/i18n";

export type CodeProblem = Exclude<CodeVerdict, { status: "ok" }> & { typed: string };

export function CodeSheet({ problem, onFix, onSkip }: { problem: CodeProblem | null; onFix: () => void; onSkip: () => void }) {
  const p = problem;
  const title = !p ? null : p.status === "expired" ? t(<>Code <em>expiré</em></>, <>Code <em>expired</em></>) : p.status === "own" ? t(<>C'est <em>ton code</em></>, <>That's <em>your code</em></>)
    : p.status === "already" ? t(<>Déjà un <em>code</em></>, <>Already a <em>code</em></>) : t(<>Code <em>introuvable</em></>, <>Code <em>not found</em></>);
  const text = !p ? "" : p.status === "expired" ? t(`Il n'est plus valable depuis le ${p.since}.`, `It stopped being valid on ${p.since}.`)
    : p.status === "own" ? t("Ton code, c'est pour tes amis : partage-le, ils l'utilisent en s'inscrivant.", "Your code is for your friends: share it, they use it when they sign up.")
      : p.status === "already" ? t(`Un seul code par compte : tu as déjà utilisé ${p.code}.`, `One code per account: you've already used ${p.code}.`)
        : t("Ce code ne correspond à aucun ami ni créateur. Vérifie-le avec la personne qui te l'a donné.", "This code doesn't match any friend or creator. Check it with the person who gave it to you.");
  return (
    <Dialog open={!!p} onClose={onFix} icon="gift" badge="!" title={title} label={t("Code refusé", "Code refused")}>
      <p>{text}</p>
      {p && <span className={"cd-typed" + (p.status === "expired" ? " old" : "")}>{p.typed}</span>}
      <Pill block onClick={onFix}>{t("Corriger le code", "Fix the code")}</Pill>
      <TextLink onClick={onSkip}>{t("Continuer sans code", "Continue without a code")}</TextLink>
    </Dialog>
  );
}
