import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPendingOrder, clearPendingOrders, loadPendingOrders, removePendingOrder, withRetries, type PendingOrder } from './pendingOrders';

// Minimal in-memory localStorage for the node test environment.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const order = (contractOrderId: number, chainId = 84532): PendingOrder => ({
  serviceId: 'svc',
  serviceTitle: 'Test',
  contractOrderId,
  txHashFunding: '0xabc',
  chainId,
  buyerWallet: '0xbuyer',
  sellerWallet: '0xseller',
  amountUsdc: 2,
  deliveryDays: 1,
  createdAt: 0,
});

beforeEach(() => store.clear());

describe('pending orders', () => {
  it('stores one entry per network and order id, and removes it once registered', () => {
    addPendingOrder(order(9));
    addPendingOrder(order(9)); // same order again: no duplicate
    addPendingOrder(order(9, 8453)); // same id on another network is another order
    expect(loadPendingOrders().map((o) => [o.chainId, o.contractOrderId])).toEqual([
      [8453, 9],
      [84532, 9],
    ]);
    removePendingOrder({ chainId: 84532, contractOrderId: 9 });
    expect(loadPendingOrders()).toHaveLength(1);
    clearPendingOrders();
    expect(loadPendingOrders()).toEqual([]);
  });

  it('drops the legacy cache that produced duplicate orders', () => {
    store.set('mercadopleis_custom_orders', '[{"id":"ord-1"}]');
    loadPendingOrders();
    expect(store.has('mercadopleis_custom_orders')).toBe(false);
  });

  it('survives corrupted storage', () => {
    store.set('mercadopleis_pending_orders', 'not json');
    expect(loadPendingOrders()).toEqual([]);
  });
});

describe('withRetries', () => {
  it('retries until the call succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('lag')).mockResolvedValueOnce('ok');
    await expect(withRetries(fn, 3, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last attempt with the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    await expect(withRetries(fn, 3, 1)).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
