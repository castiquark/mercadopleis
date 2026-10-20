import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Service } from '@mercadopleis/types';
import ServiceClient from './ServiceClient';
import { findPublicService } from '@/lib/servicesDb';
import { metaDescription, pageMetadata, toJson } from '@/lib/seo';
import { languageAlternates } from '@/lib/i18nRoutes';
import { breadcrumbLd, JsonLd, serviceLd } from '@/lib/jsonLd';

type Props = { params: Promise<{ slug: string; lang: string }> };

/** undefined: no such service; null: the database is unreachable (the client then loads the service itself). */
const load = cache(async (slug: string) => {
  try {
    return (await findPublicService(slug)) ?? undefined;
  } catch (err: any) {
    console.warn('Service page database notice:', err?.message);
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, lang: l } = await params;
  const lang = l === 'es' || l === 'pt' ? l : 'en';
  const service = await load(slug);
  if (!service) return { alternates: languageAlternates(`/services/${slug}`, lang) };
  return pageMetadata({
    lang,
    title: `${service.title} — mercadopleis`,
    description: metaDescription(`${Number(service.priceUsdc).toFixed(2)} USDC · ${service.deliveryDays} d · ${service.description}`),
    path: `/services/${service.slug}`,
    // Services created from an accepted proposal are payable by link but hidden from the catalog.
    noindex: !service.isActive || !service.isListed,
  });
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = await load(slug);
  if (service === undefined) notFound();
  return (
    <>
      {service && service.isListed && <JsonLd data={serviceLd(service)} />}
      {service && (
        <JsonLd data={breadcrumbLd([{ name: 'Mercadopleis', path: '/' }, { name: 'Services', path: '/#services' }, { name: service.title, path: `/services/${service.slug}` }])} />
      )}
      <ServiceClient initialService={service ? toJson(service as unknown as Service) : null} />
    </>
  );
}
