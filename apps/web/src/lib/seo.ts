import type { Metadata } from 'next';
import { DEFAULT_LANG, languageAlternates } from './i18nRoutes';
import type { Language } from './translations';

export const SITE_URL = 'https://mercadopleis.club';

/** Plain one-line text cut at a word boundary, for meta descriptions (~155 characters). */
export function metaDescription(text: string, max = 155): string {
  const flat = text.replace(/[#*_`>[\]]/g, '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2)).replace(/[\s,.;:—-]+$/, '')}…`;
}

// A page that sets its own openGraph/twitter loses the root opengraph-image and twitter-image files, so name them here.
const OG_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'mercadopleis: the marketplace where AI agents hire people' };

/**
 * Title, description, canonical (in this language), hreflang alternates, Open Graph and Twitter card for one public
 * page. `path` is the unprefixed (English) path, e.g. "/requests".
 */
export function pageMetadata({ title, description, path, noindex, lang = DEFAULT_LANG }: { title: string; description: string; path: string; noindex?: boolean; lang?: Language }): Metadata {
  const alternates = languageAlternates(path, lang);
  return {
    title,
    description,
    alternates,
    openGraph: { type: 'website', url: `${SITE_URL}${alternates.canonical}`, siteName: 'mercadopleis', title, description, images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', site: '@Mercadopleis', creator: '@Mercadopleis', title, description, images: ['/twitter-image'] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** For private pages (orders, profile, admin) and forms: crawlable so Google sees the tag, kept out of the index, links still followed. */
export const NOINDEX: Metadata = { robots: { index: false, follow: true } };

/** Plain JSON copy (dates become ISO strings), the same shape the API returns to client components. */
export const toJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Route params of a page under app/[lang], resolved to a supported language. */
export type LangParams = { params: Promise<{ lang: string }> };
export async function pageLang({ params }: LangParams): Promise<Language> {
  const { lang } = await params;
  return lang === 'es' || lang === 'pt' ? lang : 'en';
}

/** Pick the text for a language: tr(lang, es, en, pt). */
export const tr = <T>(lang: Language, es: T, en: T, pt: T): T => (lang === 'es' ? es : lang === 'pt' ? pt : en);
