import Link from '@/components/LocaleLink';
import type { Metadata } from 'next';
import { breadcrumbLd, JsonLd } from '@/lib/jsonLd';
import { landingCopy, type Landing } from '@/lib/landings';
import { languageAlternates, localePath } from '@/lib/i18nRoutes';
import { SITE_URL } from '@/lib/seo';
import type { Language } from '@/lib/translations';

/** Metadata of a landing: its own canonical when translated, the English URL while it only exists in English. */
export function landingMetadata(landing: Landing, lang: Language): Metadata {
  const { copy, translated } = landingCopy(landing, lang);
  const translatedLangs = (['en', 'es', 'pt'] as const).filter((l) => landing[l]);
  const all = languageAlternates(landing.path, lang);
  const languages = Object.fromEntries(Object.entries(all.languages).filter(([k]) => k === 'x-default' || translatedLangs.includes(k as Language)));
  const canonical = translated ? all.canonical : landing.path;
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical, languages },
    openGraph: { type: 'article', url: `${SITE_URL}${canonical}`, siteName: 'mercadopleis', title: copy.title, description: copy.description, images: [{ url: '/opengraph-image', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', site: '@Mercadopleis', title: copy.title, description: copy.description, images: ['/twitter-image'] },
  };
}

/** An evergreen, server-rendered landing page (copy in lib/landings.ts) with FAQ and breadcrumb structured data. */
export function LandingPage({ landing, lang }: { landing: Landing; lang: Language }) {
  const { copy, translated } = landingCopy(landing, lang);
  const textLang = translated ? lang : 'en';
  const relatedHeading = textLang === 'en' ? 'Related' : 'Relacionado';
  // Read by the language suggestion bar, so it never offers a language this page is not written in.
  const langs = (['en', 'es', 'pt'] as const).filter((l) => landing[l]).join(',');
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8" lang={textLang} data-page-langs={langs}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: copy.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }}
      />
      <JsonLd data={breadcrumbLd([{ name: 'Mercadopleis', path: localePath('/', lang) }, { name: copy.eyebrow, path: translated ? localePath(landing.path, lang) : landing.path }])} />

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-light">{copy.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{copy.h1}</h1>
      <p className="mt-5 text-lg leading-relaxed text-slate-300">{copy.lead}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        {copy.ctas.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={
              c.primary
                ? 'inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover'
                : 'inline-flex items-center rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-surface-elevated'
            }
          >
            {c.label}
          </Link>
        ))}
      </div>

      {copy.sections.map((s) => (
        <section key={s.heading} className="mt-12">
          <h2 className="text-2xl font-bold text-white">{s.heading}</h2>
          {s.paragraphs?.map((p, i) => (
            <p key={i} className="mt-4 leading-relaxed text-slate-300">
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-slate-300 marker:text-primary-light">
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {copy.related && copy.related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white">{relatedHeading}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {copy.related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="text-primary-light hover:underline">
                  {r.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white">FAQ</h2>
        <dl className="mt-4 space-y-4">
          {copy.faq.map((f) => (
            <div key={f.q} className="rounded-xl border border-border bg-surface p-5">
              <dt className="font-semibold text-white">{f.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-400">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8">
        {copy.ctas.map((c) => (
          <Link key={c.href} href={c.href} className="text-sm font-semibold text-primary-light hover:underline">
            {c.label} →
          </Link>
        ))}
      </div>
    </article>
  );
}
