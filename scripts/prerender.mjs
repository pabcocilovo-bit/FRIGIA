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
const { render, renderLegal, FAQ, LEGAL } = await import(pathToFileURL(resolve(out, entry)).href);
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

// Pages légales : de vraies pages HTML, sans JavaScript (/cgu, /confidentialite, /mentions-legales, /cookies)
const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
for (const p of LEGAL) {
  const title = `${p.title} · Frigia`;
  writeFileSync(resolve(dist, `${p.slug}.html`), `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(p.description)}" />
    <link rel="canonical" href="https://frigia.fr/${p.slug}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://frigia.fr/${p.slug}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(p.description)}" />
    <meta property="og:image" content="https://frigia.fr/og-frigia.png" />
    <meta property="og:locale" content="fr_FR" />
    <meta name="theme-color" content="#F5EFE3" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" />
    <link rel="stylesheet" href="/assets/${css}" />
    <style>body{margin:0;background:#F5EFE3}</style>
  </head>
  <body>
    ${renderLegal(p.slug)}
  </body>
</html>
`);
}
rmSync(out, { recursive: true, force: true });

console.log(`Pré-rendu : ${Math.round(html.length / 1024)} Ko de HTML, ${FAQ.length} questions en FAQPage, style ${css}, pages ${LEGAL.map(p => "/" + p.slug).join(" ")}`);
