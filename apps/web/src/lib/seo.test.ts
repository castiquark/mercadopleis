import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metaDescription, pageMetadata } from './seo';

const findPublicService = vi.fn();
const findRequest = vi.fn();
let dbDown = false;
vi.mock('@/lib/servicesDb', () => ({
  findPublicService: async (slug: string) => {
    if (dbDown) throw new Error('db down');
    return findPublicService(slug);
  },
  listPublicServices: async () => {
    if (dbDown) throw new Error('db down');
    return [service];
  },
}));
vi.mock('@/lib/requestsDb', async () => ({
  findRequest: (slug: string) => findRequest(slug),
  listRequests: async () => {
    if (dbDown) throw new Error('db down');
    return [{ slug: 'dataset-jsonl', createdAt: new Date('2026-10-02T00:00:00Z'), proposalCount: 2 }];
  },
  requestDetail: async (found: any) => ({ request: { ...found, proposals: undefined, proposalCount: found.proposals.length, isOwner: false }, proposals: [], award: null }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/app/[lang]/services/[slug]/ServiceClient', () => ({ default: () => null }));
vi.mock('@/app/[lang]/requests/RequestsClient', () => ({ default: () => null }));
vi.mock('@/app/[lang]/HomeClient', () => ({ default: () => null }));
vi.mock('@/app/[lang]/requests/[slug]/RequestClient', () => ({ default: () => null }));

// Pages return a fragment: JSON-LD blocks plus the client component.
const children = (el: any): any[] => [el.props.children].flat().filter(Boolean);
const client = (el: any) => children(el).find((c) => c.props && ('initialService' in c.props || 'initialData' in c.props || 'initialServices' in c.props || 'initialRequests' in c.props)) ?? el;
const jsonLd = (el: any) => children(el).filter((c) => c.props?.data).map((c) => c.props.data);

const params = (slug: string, lang = 'en') => ({ params: Promise.resolve({ slug, lang }) });
const service = {
  slug: 'transcripcion-audio',
  title: 'Transcripción de audio',
  description: 'Transcribo audio en español con marcas de tiempo. '.repeat(10),
  priceUsdc: '25.00',
  deliveryDays: 3,
  isActive: true,
  isListed: true,
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

describe('metaDescription', () => {
  it('keeps short text and cuts long text at a word boundary', () => {
    expect(metaDescription('  Hola\n\n**mundo**  ')).toBe('Hola mundo');
    const cut = metaDescription('palabra '.repeat(40));
    expect(cut.length).toBeLessThanOrEqual(155);
    expect(cut.endsWith('palabra…')).toBe(true);
  });
});

describe('pageMetadata', () => {
  it('sets the canonical and social cards for the page, and noindex only when asked', () => {
    const m = pageMetadata({ title: 'T', description: 'D', path: '/x' });
    expect(m.alternates?.canonical).toBe('/x');
    expect((m.openGraph as any).url).toBe('https://mercadopleis.club/x');
    expect(m.robots).toBeUndefined();
    expect(pageMetadata({ title: 'T', description: 'D', path: '/x', noindex: true }).robots).toEqual({ index: false, follow: true });
  });
});

describe('service page (server render)', () => {
  beforeEach(() => findPublicService.mockReset());

  it('renders the service for crawlers with its own title and canonical', async () => {
    findPublicService.mockResolvedValue(service);
    const mod = await import('@/app/[lang]/services/[slug]/page');
    const meta = await mod.generateMetadata(params(service.slug));
    expect(meta.title).toBe('Transcripción de audio — mercadopleis');
    expect(meta.alternates?.canonical).toBe('/services/transcripcion-audio');
    expect(meta.description).toMatch(/^25\.00 USDC · 3 d · Transcribo/);
    expect(meta.robots).toBeUndefined();
    const el: any = await mod.default(params(service.slug));
    expect(client(el).props.initialService.title).toBe(service.title);
    expect(client(el).props.initialService.createdAt).toBe('2026-10-01T00:00:00.000Z');
    const [svc, crumbs] = jsonLd(el);
    expect(svc).toMatchObject({ '@type': 'Service', name: service.title, offers: { price: '25.00', priceCurrency: 'USDC' } });
    expect(crumbs['@type']).toBe('BreadcrumbList');
  });

  it('keeps unlisted services out of the index, answers 404 for unknown ones, and falls back to the client without a database', async () => {
    const mod = await import('@/app/[lang]/services/[slug]/page');
    findPublicService.mockResolvedValue({ ...service, slug: 'privado', isListed: false });
    expect((await mod.generateMetadata(params('privado'))).robots).toEqual({ index: false, follow: true });

    findPublicService.mockResolvedValue(undefined);
    await expect(mod.default(params('no-existe'))).rejects.toThrow('NEXT_NOT_FOUND');

    dbDown = true;
    const el: any = await mod.default(params('sin-base'));
    dbDown = false;
    expect(client(el).props.initialService).toBeNull();
  });
});

describe('request page (server render)', () => {
  beforeEach(() => findRequest.mockReset());

  it('renders the public view with a canonical by slug, and noindex when cancelled', async () => {
    const found = { id: 'u1', slug: 'dataset-jsonl', title: 'Dataset en JSONL', description: 'Necesito 500 filas.', budgetUsdc: '40', deliveryDays: 5, status: 'OPEN', proposals: [{ id: 'p1' }] };
    findRequest.mockResolvedValue(found);
    const mod = await import('@/app/[lang]/requests/[slug]/page');
    const meta = await mod.generateMetadata(params('u1'));
    expect(meta.alternates?.canonical).toBe('/requests/dataset-jsonl');
    expect(meta.robots).toBeUndefined();
    const el: any = await mod.default(params('dataset-jsonl'));
    expect(client(el).props.initialData.request.title).toBe('Dataset en JSONL');
    expect(client(el).props.initialData.proposals).toEqual([]);

    findRequest.mockResolvedValue({ ...found, status: 'CANCELLED' });
    expect((await mod.generateMetadata(params('cancelada'))).robots).toEqual({ index: false, follow: true });
  });
});

describe('social images', () => {
  it('keeps the site image on pages with their own Open Graph and Twitter cards', () => {
    const m = pageMetadata({ title: 'T', description: 'D', path: '/x' });
    expect((m.openGraph as any).images[0].url).toBe('/opengraph-image');
    expect((m.twitter as any).images).toEqual(['/twitter-image']);
  });
});

describe('home page (server render)', () => {
  it('puts the catalog in the HTML, and hands null to the client when the database is down (never an empty list)', async () => {
    const mod = await import('@/app/[lang]/page');
    const el: any = await mod.default();
    expect(client(el).props.initialServices.map((x: any) => x.slug)).toEqual(['transcripcion-audio']);
    expect(mod.revalidate).toBe(60);
    expect(jsonLd(el).map((d: any) => d['@type'])).toEqual(['Organization', 'WebSite']);

    dbDown = true;
    const down: any = await mod.default();
    dbDown = false;
    expect(client(down).props.initialServices).toBeNull();
  });
});

describe('requests list page (server render)', () => {
  it('puts the open requests in the HTML, and hands null to the client when the database is down', async () => {
    const mod = await import('@/app/[lang]/requests/page');
    const el: any = await mod.default();
    expect(el.props.initialRequests).toEqual([{ slug: 'dataset-jsonl', createdAt: '2026-10-02T00:00:00.000Z', proposalCount: 2 }]);
    expect(mod.revalidate).toBe(60);
    dbDown = true;
    const down: any = await mod.default();
    dbDown = false;
    expect(down.props.initialRequests).toBeNull();
  });
});

describe('JsonLd', () => {
  it('escapes "<" so seller text cannot close the script tag', async () => {
    const { JsonLd } = await import('./jsonLd');
    const el: any = JsonLd({ data: { name: '</script><script>alert(1)</script>' } });
    expect(el.props.dangerouslySetInnerHTML.__html).not.toContain('<');
    expect(JSON.parse(el.props.dangerouslySetInnerHTML.__html).name).toBe('</script><script>alert(1)</script>');
  });
});
