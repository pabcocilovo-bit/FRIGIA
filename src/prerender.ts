// Entrée du pré-rendu (scripts/prerender.mjs) : la landing rendue en HTML, sans navigateur.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import Landing from "./Landing";

export { FAQ } from "./landing/faq";

export function render() {
  return renderToString(createElement(Landing));
}
