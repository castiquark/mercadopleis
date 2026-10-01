import { API_URL } from './config.js';

export interface Service {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  priceUsdc: string;
  deliveryDays: number;
  deliveryType: string;
  seller: { walletAddress: string; displayName: string; username: string };
  price: { amount: string; currency: string; tokenAddress: string; decimals: number };
  settlement: { chainId: number; escrowContract: string; feeBps: number; reviewWindowDays: number };
  [key: string]: unknown;
}

export async function fetchServices(params: Record<string, string | number | undefined> = {}): Promise<Service[]> {
  const url = new URL('/api/services', API_URL);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Mercadopleis API error ${res.status} on ${url.pathname}`);
  const data = (await res.json()) as { services?: Service[] };
  return data.services ?? [];
}

export async function fetchService(slugOrId: string): Promise<Service | null> {
  const bySlug = await fetch(new URL(`/api/services/${encodeURIComponent(slugOrId)}`, API_URL), {
    headers: { Accept: 'application/json' },
  });
  if (bySlug.ok) {
    const data = (await bySlug.json()) as { service?: Service };
    if (data.service) return data.service;
  }
  const all = await fetchServices({ limit: 100 });
  return all.find((s) => s.id === slugOrId || s.slug === slugOrId) ?? null;
}
