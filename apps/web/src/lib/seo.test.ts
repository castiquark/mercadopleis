import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metaDescription, pageMetadata } from './seo';

const findPublicService = vi.fn();
const findRequest = vi.fn();
let dbDown = false;
vi.mock('@/lib/servicesDb', () => ({ findPublicService: async (slug: string) => {
    if (dbDown) throw new Error('db down');
    return findPublicService(slug);
  },
}));
vi.mock('@/lib/requestsDb', async () => ({
  findRequest: (slug: string) => findRequest(slug),
  requestDetail: async (found: any) => ({ request: { ...found, proposals: undefined, proposalCount: found.proposals.length, isOwner: false }, proposals: [], award: null }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/app/services/[slug]/ServiceClient', () => ({ default: () => null }));
vi.mock('@/app/requests/[slug]/RequestClient', () => ({ default: () => null }));

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
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
    const mod = await import('@/app/services/[slug]/page');
    const meta = await mod.generateMetadata(params(service.slug));
    expect(meta.title).toBe('Transcripción de audio — mercadopleis');
    expect(meta.alternates?.canonical).toBe('/services/transcripcion-audio');
    expect(meta.description).toMatch(/^25\.00 USDC · 3 d · Transcribo/);
    expect(meta.robots).toBeUndefined();
    const el: any = await mod.default(params(service.slug));
    expect(el.props.initialService.title).toBe(service.title);
    expect(el.props.initialService.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('keeps unlisted services out of the index, answers 404 for unknown ones, and falls back to the client without a database', async () => {
    const mod = await import('@/app/services/[slug]/page');
    findPublicService.mockResolvedValue({ ...service, slug: 'privado', isListed: false });
    expect((await mod.generateMetadata(params('privado'))).robots).toEqual({ index: false, follow: true });

    findPublicService.mockResolvedValue(undefined);
    await expect(mod.default(params('no-existe'))).rejects.toThrow('NEXT_NOT_FOUND');

    dbDown = true;
    const el: any = await mod.default(params('sin-base'));
    dbDown = false;
    expect(el.props.initialService).toBeNull();
  });
});

describe('request page (server render)', () => {
  beforeEach(() => findRequest.mockReset());

  it('renders the public view with a canonical by slug, and noindex when cancelled', async () => {
    const found = { id: 'u1', slug: 'dataset-jsonl', title: 'Dataset en JSONL', description: 'Necesito 500 filas.', budgetUsdc: '40', deliveryDays: 5, status: 'OPEN', proposals: [{ id: 'p1' }] };
    findRequest.mockResolvedValue(found);
    const mod = await import('@/app/requests/[slug]/page');
    const meta = await mod.generateMetadata(params('u1'));
    expect(meta.alternates?.canonical).toBe('/requests/dataset-jsonl');
    expect(meta.robots).toBeUndefined();
    const el: any = await mod.default(params('dataset-jsonl'));
    expect(el.props.initialData.request.title).toBe('Dataset en JSONL');
    expect(el.props.initialData.proposals).toEqual([]);

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
