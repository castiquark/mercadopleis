// Wallet sign-in (SIWE, EIP-4361) and authenticated calls to the Mercadopleis API.
// The server never sees a private key: it builds the message, the agent's wallet signs it, and the API returns a
// session. Over stdio the session stays in this process's memory and is never returned to the agent. Over HTTP the
// server is stateless, so the session travels with each request as an opaque token (see withSession).
import { AsyncLocalStorage } from 'node:async_hooks';
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

interface Holder {
  session: Session | null;
}

// stdio: one process per agent, one session. HTTP: each request runs with its own holder.
const processHolder: Holder = { session: null };
const requestHolder = new AsyncLocalStorage<Holder>();
const holder = () => requestHolder.getStore() ?? processHolder;

const TOKEN_PREFIX = 'mpl1.';

/** Opaque session token for HTTP clients: the API session plus the wallet it belongs to. */
export function encodeSessionToken(s: Session): string {
  return TOKEN_PREFIX + Buffer.from(JSON.stringify({ a: s.address, u: s.userId, t: s.token })).toString('base64url');
}

export function decodeSessionToken(token: string | null | undefined): Session | null {
  if (!token?.startsWith(TOKEN_PREFIX)) return null;
  try {
    const { a, u, t } = JSON.parse(Buffer.from(token.slice(TOKEN_PREFIX.length), 'base64url').toString('utf8'));
    return typeof a === 'string' && typeof u === 'string' && typeof t === 'string' ? { address: a, userId: u, token: t } : null;
  } catch {
    return null;
  }
}

/** Runs fn with its own session, taken from a token (HTTP). Calls inside never see another request's session. */
export function withSession<T>(token: string | null | undefined, fn: () => T): T {
  return requestHolder.run({ session: decodeSessionToken(token) }, fn);
}

export const currentSession = () => {
  const s = holder().session;
  return s ? { address: s.address, userId: s.userId } : null;
};

export const currentSessionToken = () => {
  const s = holder().session;
  return s ? encodeSessionToken(s) : null;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string>) };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const s = holder().session;
    if (!s) throw new ApiError(401, 'Not signed in. Call prepare_login and login with the buyer wallet first.');
    headers.Authorization = `Bearer ${s.token}`;
  }
  const res = await fetch(new URL(path, API_URL), { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    if (res.status === 401 && auth) holder().session = null;
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
  holder().session = { address: data.user.walletAddress, userId: data.user.id, token: data.token };
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
  description?: string;
  category?: string;
  createdAt?: string;
  buyer?: { displayName?: string; walletAddress?: string } | null;
}

export interface ApiProposal {
  id: string;
  priceUsdc: string;
  deliveryDays: number;
  message: string;
  status: string;
  milestones?: { title: string; amountUsdc: string | number; deliveryDays: number }[] | null;
  seller?: { displayName?: string; walletAddress?: string } | null;
}

export const createRequest = (body: { title: string; description: string; category: string; budgetUsdc: string; deliveryDays: number }) =>
  call<{ request: ApiRequest }>('/api/requests', { method: 'POST', body: JSON.stringify(body) }, true).then((d) => d.request);

/** Open requests (public). The API filters by category and text; budget and deadline are filtered by the caller. */
export const listOpenRequests = (params: { category?: string; search?: string; limit?: number }) => {
  const q = new URLSearchParams({ status: 'OPEN', limit: String(params.limit ?? 100) });
  if (params.category) q.set('category', params.category);
  if (params.search) q.set('search', params.search);
  return call<{ count: number; requests: ApiRequest[] }>(`/api/requests?${q}`).then((d) => d.requests);
};

export const sendProposal = (
  requestIdOrSlug: string,
  body: { priceUsdc?: string; deliveryDays?: number; message: string; milestones?: { title: string; amountUsdc: string; deliveryDays: number }[] }
) =>
  call<{ proposal: ApiProposal }>(
    `/api/requests/${encodeURIComponent(requestIdOrSlug)}/proposals`,
    { method: 'POST', body: JSON.stringify(body) },
    true
  ).then((d) => d.proposal);

export const getRequest = (idOrSlug: string) =>
  call<{ request: ApiRequest & { isOwner?: boolean }; proposals: ApiProposal[]; award: { serviceSlug: string | null } | null }>(
    `/api/requests/${encodeURIComponent(idOrSlug)}`,
    {},
    true
  );

export const acceptProposal = (requestId: string, proposalId: string) =>
  call<{
    service: { id: string; slug: string; priceUsdc: string; deliveryDays: number };
    phases?: { index: number; slug: string; priceUsdc: string; deliveryDays: number }[];
  }>(
    `/api/requests/${requestId}/proposals/${proposalId}`,
    { method: 'PATCH', body: JSON.stringify({ action: 'accept' }) },
    true
  );
