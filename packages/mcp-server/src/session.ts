// Wallet sign-in (SIWE, EIP-4361) and authenticated calls to the Mercadopleis API.
// The server never sees a private key: it builds the message, the agent's wallet signs it, and the
// resulting session token stays in this process's memory (it is never returned to the agent).
import { API_URL } from './config.js';

export interface SiweParams {
  apiUrl: string;
  address: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}

/** Same format as the web app; the API checks domain, URI, chain, nonce and a 10-minute freshness window. */
export function buildSiweMessage({ apiUrl, address, chainId, nonce, issuedAt }: SiweParams): string {
  const origin = new URL(apiUrl);
  const statement = 'Sign in to mercadopleis with your wallet. / Inicia sesión en mercadopleis con tu wallet.';
  return `${origin.host} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${origin.origin}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
}

interface Session {
  address: string;
  userId: string;
  token: string;
}

let session: Session | null = null;

export const currentSession = () => (session ? { address: session.address, userId: session.userId } : null);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string>) };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (auth) {
    if (!session) throw new ApiError(401, 'Not signed in. Call prepare_login and login with the buyer wallet first.');
    headers.Authorization = `Bearer ${session.token}`;
  }
  const res = await fetch(new URL(path, API_URL), { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    if (res.status === 401 && auth) session = null;
    throw new ApiError(res.status, data.error || `Mercadopleis API error ${res.status} on ${path}`);
  }
  return data;
}

export async function requestNonce(address: string): Promise<string> {
  const { nonce } = await call<{ nonce: string }>(`/api/auth/nonce?address=${encodeURIComponent(address)}`);
  return nonce;
}

export async function signIn(address: string, message: string, signature: string) {
  const data = await call<{ token: string; user: { id: string; walletAddress: string } }>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address, message, signature }),
  });
  session = { address: data.user.walletAddress, userId: data.user.id, token: data.token };
  return currentSession()!;
}

export interface ApiOrder {
  id: string;
  contractOrderId: number | null;
  chainId: number;
  escrowAddress: string | null;
  status: string;
  buyerId: string;
  sellerId: string;
  deliveryHash: string | null;
  service?: { title?: string; slug?: string } | null;
}

export const myOrders = () => call<{ orders: ApiOrder[] }>('/api/orders/my', {}, true).then((d) => d.orders);

export const registerOrder = (body: { serviceId: string; contractOrderId: number; txHashFunding: string; chainId: number }) =>
  call<{ order: ApiOrder }>('/api/orders', { method: 'POST', body: JSON.stringify(body) }, true);

export const readMessages = (orderUuid: string) =>
  call<{ messages: { content: string; createdAt: string; sender?: { walletAddress?: string; displayName?: string } }[] }>(
    `/api/orders/${orderUuid}/messages`,
    {},
    true
  ).then((d) => d.messages);

export const postMessage = (orderUuid: string, content: string) =>
  call<{ message: { id: string; createdAt: string } }>(
    `/api/orders/${orderUuid}/messages`,
    { method: 'POST', body: JSON.stringify({ content }) },
    true
  );

export const deliverableAccess = (orderUuid: string) =>
  call<{ type: 'storage' | 'external'; url: string; deliveryHash?: string; expiresInSeconds?: number }>(
    `/api/orders/${orderUuid}/deliverable`,
    {},
    true
  );

/** Asks the indexer to import recent escrow events (public, rate limited). Best effort. */
export async function syncChain(chainId: number) {
  try {
    await fetch(new URL(`/api/sync?chainId=${chainId}`, API_URL));
  } catch {
    // The next sync catches up.
  }
}

// --- Requests (bounties) ---

export interface ApiRequest {
  id: string;
  slug: string;
  title: string;
  status: string;
  budgetUsdc: string;
  deliveryDays: number;
  proposalCount?: number;
}

export interface ApiProposal {
  id: string;
  priceUsdc: string;
  deliveryDays: number;
  message: string;
  status: string;
  seller?: { displayName?: string; walletAddress?: string } | null;
}

export const createRequest = (body: { title: string; description: string; category: string; budgetUsdc: string; deliveryDays: number }) =>
  call<{ request: ApiRequest }>('/api/requests', { method: 'POST', body: JSON.stringify(body) }, true).then((d) => d.request);

export const getRequest = (idOrSlug: string) =>
  call<{ request: ApiRequest & { isOwner?: boolean }; proposals: ApiProposal[]; award: { serviceSlug: string | null } | null }>(
    `/api/requests/${encodeURIComponent(idOrSlug)}`,
    {},
    true
  );

export const acceptProposal = (requestId: string, proposalId: string) =>
  call<{ service: { id: string; slug: string; priceUsdc: string; deliveryDays: number } }>(
    `/api/requests/${requestId}/proposals/${proposalId}`,
    { method: 'PATCH', body: JSON.stringify({ action: 'accept' }) },
    true
  );
