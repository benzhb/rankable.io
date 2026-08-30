import type { ReactNode } from "react";

const contactEmail = (import.meta.env.VITE_LEGAL_CONTACT_EMAIL as string | undefined)?.trim();

export function LegalContact() {
  if (contactEmail) {
    return <a href={`mailto:${contactEmail}`}>{contactEmail}</a>;
  }

  return (
    <span>
      the private support contact listed on Rankable.io&apos;s Discord application profile
    </span>
  );
}

export function LegalPageLayout({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <a className="legal-brand" href="/" aria-label="Rankable.io home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>rankable.io</span>
        </a>
        <nav className="legal-nav" aria-label="Legal documents">
          <a href="/privacy">Privacy</a>
          <a href="/tos">Terms</a>
        </nav>
      </header>

      <article className="legal-document">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="legal-summary">{summary}</p>
        <p className="legal-effective"><strong>Effective:</strong> August 29, 2026</p>
        {children}
      </article>

      <footer className="legal-footer">
        <span>Rankable.io</span>
        <span>Build the tier list together.</span>
      </footer>
    </main>
  );
}
