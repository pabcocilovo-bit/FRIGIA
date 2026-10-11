// Entrée du pré-rendu (scripts/prerender.mjs) : la landing et les pages légales rendues en HTML, sans navigateur.
import { createElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import Landing from "./Landing";
import { LegalPage } from "./landing/LegalPage";
import { LEGAL } from "./legal/pages";

export { FAQ } from "./landing/faq";
export { LEGAL };

export function render() {
  return renderToString(createElement(Landing));
}

export function renderLegal(slug: string) {
  const page = LEGAL.find(p => p.slug === slug)!;
  return renderToStaticMarkup(createElement(LegalPage, { page }));
}
