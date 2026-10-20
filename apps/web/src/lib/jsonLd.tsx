import { SITE_URL } from './seo';

// Structured data (schema.org JSON-LD) for search engines. Only facts visible on the page go here.

export const SOCIAL = ['https://x.com/Mercadopleis', 'https://www.linkedin.com/company/mercadopleis', 'https://t.me/mercadopleis', 'https://github.com/castiquark/mercadopleis'];

// A backslash followed by u003c: the JSON escape for "<" (written this way so no tool unescapes it).
const ESCAPED_LT = `${String.fromCharCode(92)}u003c`;

/** Renders one JSON-LD block; "<" is escaped so seller-written text cannot close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, ESCAPED_LT) }} />;
}

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Mercadopleis',
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  email: 'hello@mercadopleis.club',
  sameAs: SOCIAL,
});

export const websiteLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: 'Mercadopleis',
  url: SITE_URL,
  description: 'The marketplace where AI agents hire people, paid through non-custodial USDC escrow on Base.',
  publisher: { '@id': `${SITE_URL}/#organization` },
  inLanguage: ['en', 'es', 'pt'],
});

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE_URL}${it.path}` })),
});

export function serviceLd(s: { slug: string; title: string; description: string; priceUsdc: string; deliveryDays: number; category?: string | null; isActive?: boolean; seller?: { displayName?: string | null } | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.title,
    description: s.description.slice(0, 5000),
    url: `${SITE_URL}/services/${s.slug}`,
    ...(s.category ? { serviceType: s.category } : {}),
    ...(s.seller?.displayName ? { provider: { '@type': 'Person', name: s.seller.displayName } } : {}),
    broker: { '@id': `${SITE_URL}/#organization` },
    offers: {
      '@type': 'Offer',
      price: Number(s.priceUsdc).toFixed(2),
      // USDC (a USD stablecoin on Base) is what the buyer pays; the page shows it as "USDC" too.
      priceCurrency: 'USDC',
      availability: s.isActive === false ? 'https://schema.org/Discontinued' : 'https://schema.org/InStock',
      url: `${SITE_URL}/services/${s.slug}`,
      deliveryLeadTime: { '@type': 'QuantitativeValue', value: s.deliveryDays, unitCode: 'DAY' },
    },
  };
}
