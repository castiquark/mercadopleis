// Orders that were funded on-chain but could not be registered with the API yet (RPC lag, expired session...).
// Kept in this browser and retried from My Orders until the API accepts them. The funds are safe in the escrow
// meanwhile; this only links the on-chain order to its service so both parties see it.

export interface PendingOrder {
  serviceId: string;
  serviceTitle: string;
  contractOrderId: number;
  txHashFunding: string;
  chainId: number;
  buyerWallet: string;
  sellerWallet: string;
  amountUsdc: number;
  deliveryDays: number;
  createdAt: number;
  /** Escrow the order was funded in (lowercase). Missing on orders saved before v3: those live in v2. */
  escrowAddress?: string;
}

const KEY = 'mercadopleis_pending_orders';
// Older builds cached every funded order under this key, which produced duplicates; it is no longer used.
const LEGACY_KEY = 'mercadopleis_custom_orders';

const sameOrder = (a: Pick<PendingOrder, 'chainId' | 'contractOrderId'>, b: Pick<PendingOrder, 'chainId' | 'contractOrderId'>) =>
  a.chainId === b.chainId && a.contractOrderId === b.contractOrderId;

export function loadPendingOrders(): PendingOrder[] {
  try {
    localStorage.removeItem(LEGACY_KEY);
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list: PendingOrder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode): the order can still be recovered from the chain by the indexer.
  }
}

export function addPendingOrder(order: PendingOrder) {
  save([order, ...loadPendingOrders().filter((o) => !sameOrder(o, order))]);
}

export function removePendingOrder(order: Pick<PendingOrder, 'chainId' | 'contractOrderId'>) {
  save(loadPendingOrders().filter((o) => !sameOrder(o, order)));
}

export function clearPendingOrders() {
  save([]);
}

/** Calls `fn` up to `attempts` times, waiting `delayMs` between failures. */
export async function withRetries<T>(fn: () => Promise<T>, attempts = 3, delayMs = 2_500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
