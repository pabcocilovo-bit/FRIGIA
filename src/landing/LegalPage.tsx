import { LEGAL, type LegalPage as Page } from "../legal/pages";
import { LegalBody } from "./legal";

// Page légale autonome (/cgu, /confidentialite, /mentions-legales, /cookies), écrite en HTML au build.
// Aucun JavaScript : de simples liens, lisibles par tout le monde et par les robots.
export function LegalPage({ page }: { page: Page }) {
  return (
    <div className="lp">
      <header className="nav">
        <div className="container">
          <a className="home" href="/" aria-label="Frigia, accueil"><img src="/landing/frigia-logo.svg" alt="Frigia" width={84} height={30} /></a>
          <div className="right"><a className="btn btn-fill" href="/">Retour à l'accueil</a></div>
        </div>
      </header>
      <main className="container legal-page lp-legal">
        <nav className="tabs" aria-label="Pages légales">
          {LEGAL.map(p => <a key={p.key} href={`/${p.slug}`} aria-current={p.key === page.key ? "page" : undefined}>{p.tab}</a>)}
        </nav>
        <h1>{page.title}</h1>
        <LegalBody blocks={page.blocks} />
      </main>
      <footer>
        <div className="container">
          <div className="base">
            <a href="/"><img src="/landing/frigia-logo-inverse.svg" alt="Frigia" width={78} height={28} /></a>
            <nav className="legal" aria-label="Informations légales">
              {LEGAL.map(p => <a key={p.key} href={`/${p.slug}`}>{p.tab}</a>)}
              <a href="mailto:frigia.contact@gmail.com">Contact</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
