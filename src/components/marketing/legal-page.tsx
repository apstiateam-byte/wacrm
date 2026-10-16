export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

/** Shared layout for Terms / Privacy / Refund pages. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      {intro ? <p className="mt-6 text-muted-foreground">{intro}</p> : null}
      {sections.map((s, i) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-lg font-semibold">
            {i + 1}. {s.heading}
          </h2>
          {s.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
