import Link from "next/link";
import { business } from "./business";
import { DRAFT_NOTICE, type LegalDocument } from "./content";

const LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
];

/** One legal page: plain, readable on a phone, no dashboard shell. A draft warning stays on every page until the dummy details are replaced. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <div lang="de" className="mx-auto min-h-screen max-w-3xl px-5 py-8 text-[15px] leading-relaxed text-ink">
      <p className="text-sm font-semibold text-brand">{business.brand}</p>
      <h1 className="mt-1 text-2xl font-semibold">{doc.title}</h1>
      {business.placeholder && (
        <p role="note" className="mt-4 rounded-control border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <strong>Entwurf.</strong> {DRAFT_NOTICE}
        </p>
      )}
      {doc.intro && <p className="mt-4 text-ink-2">{doc.intro}</p>}
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-6">
          <h2 className="text-base font-semibold">{s.heading}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mt-2 text-ink-2">{p}</p>
          ))}
        </section>
      ))}
      <nav aria-label="Rechtliche Hinweise" className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-sm">
        {LINKS.map((l) => <Link key={l.href} href={l.href} className="font-medium text-brand hover:underline">{l.label}</Link>)}
      </nav>
    </div>
  );
}
