// Après `vite build` : écrit la landing en HTML dans dist/index.html.
// Google et les assistants IA (qui n'exécutent souvent pas le JavaScript) lisent ainsi tout le texte de la page.
// Côté navigateur, la vraie landing remplace cette copie dès qu'elle est montée (voir src/Landing.tsx).
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = resolve(root, "dist");
const out = resolve(root, "node_modules/.frigia-prerender");

// Le client Supabase est créé à l'import ; le pré-rendu ne l'appelle jamais, une adresse factice suffit
process.env.VITE_SUPABASE_URL ||= "https://prerender.invalid";
process.env.VITE_SUPABASE_ANON_KEY ||= "prerender";

await build({
  root,
  configFile: false,
  logLevel: "warn",
  plugins: [react()],
  build: { ssr: "src/prerender.ts", outDir: out, emptyOutDir: true },
});

const entry = readdirSync(out).find(f => /^prerender\.m?js$/.test(f));
const { render, FAQ } = await import(pathToFileURL(resolve(out, entry)).href);
const html = render();

// La feuille de style de la landing est dans le morceau chargé à la demande : on la lie dès le <head>
const css = readdirSync(resolve(dist, "assets")).find(f => f.endsWith(".css") && readFileSync(resolve(dist, "assets", f), "utf8").includes(".lp .hero"));
if (!css) throw new Error("Feuille de style de la landing introuvable dans dist/assets");

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const file = resolve(dist, "index.html");
let page = readFileSync(file, "utf8");
if (!page.includes('<div id="root"></div>')) throw new Error('<div id="root"></div> introuvable dans dist/index.html');
page = page
  .replace("</head>", [
    `    <link rel="stylesheet" href="/assets/${css}" />`,
    `    <script type="application/ld+json">${JSON.stringify(faqLd).replace(/</g, "\\u003c")}</script>`,
    "  </head>",
  ].join("\n"))
  .replace('<div id="root"></div>', `<div id="prerender">${html}</div><div id="root"></div>`);
writeFileSync(file, page);
rmSync(out, { recursive: true, force: true });

console.log(`Pré-rendu : ${Math.round(html.length / 1024)} Ko de HTML, ${FAQ.length} questions en FAQPage, style ${css}`);
