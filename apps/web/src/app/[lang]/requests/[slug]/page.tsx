import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RequestClient from './RequestClient';
import type { RequestDetail } from '@/lib/api';
import { findRequest, requestDetail } from '@/lib/requestsDb';
import { metaDescription, pageMetadata, toJson } from '@/lib/seo';
import { languageAlternates } from '@/lib/i18nRoutes';
import { breadcrumbLd, JsonLd } from '@/lib/jsonLd';

type Props = { params: Promise<{ slug: string; lang: string }> };

/** undefined: no such request; null: the database is unreachable (the client then loads the request itself). */
const load = cache(async (slug: string) => {
  try {
    return (await findRequest(slug)) ?? undefined;
  } catch (err: any) {
    console.warn('Request page database notice:', err?.message);
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, lang: l } = await params;
  const lang = l === 'es' || l === 'pt' ? l : 'en';
  const found = await load(slug);
  if (!found) return { alternates: languageAlternates(`/requests/${slug}`, lang) };
  return pageMetadata({
    lang,
    title: `${found.title} — mercadopleis`,
    description: metaDescription(`${Number(found.budgetUsdc).toFixed(2)} USDC · ${found.deliveryDays} d · ${found.description}`),
    path: `/requests/${found.slug}`,
    noindex: found.status === 'CANCELLED',
  });
}

export default async function RequestPage({ params }: Props) {
  const { slug } = await params;
  const found = await load(slug);
  if (found === undefined) notFound();
  // The public view only (no proposals, no award): the client reloads it with the viewer's session.
  const initialData = found ? (toJson(await requestDetail(found, null)) as unknown as RequestDetail) : null;
  return (
    <>
      {found && <JsonLd data={breadcrumbLd([{ name: 'Mercadopleis', path: '/' }, { name: 'Requests', path: '/requests' }, { name: found.title, path: `/requests/${found.slug}` }])} />}
      <RequestClient initialData={initialData} />
    </>
  );
}
