import { describe, expect, it } from 'vitest';
import { buildActivity, type ActionOrderRow } from './activity';

const ME = 'me';
const order = (patch: Partial<ActionOrderRow>): ActionOrderRow => ({
  id: 'o1',
  contract_order_id: '7',
  chain_id: '8453',
  status: 'FUNDED',
  auto_release_deadline: null,
  buyer_id: 'b',
  seller_id: ME,
  title: 'Label 500 tickets',
  ...patch,
});

describe('buildActivity', () => {
  it('asks the seller to deliver a funded order and the buyer to review a delivery', () => {
    const { items } = buildActivity(ME, [order({}), order({ id: 'o2', status: 'DELIVERED', buyer_id: ME, seller_id: 's' })], [], [], 0, 1000);
    expect(items.map((i) => [i.kind, i.href])).toEqual([
      ['review', '/orders?tab=buyer&order=o2'],
      ['deliver', '/orders?tab=seller&order=o1'],
    ]);
    expect(items[1]).toMatchObject({ contractOrderId: 7, chainId: 8453 });
  });

  it('offers the payout to the seller only once the review window has ended', () => {
    const delivered = order({ status: 'DELIVERED', auto_release_deadline: '2000' });
    expect(buildActivity(ME, [delivered], [], [], 0, 1999).items).toEqual([]);
    expect(buildActivity(ME, [delivered], [], [], 0, 2000).items.map((i) => i.kind)).toEqual(['claim']);
  });

  it('counts unread messages and pending proposals, and shows open disputes to admins first', () => {
    const { total, items } = buildActivity(
      ME,
      [order({ status: 'DISPUTED' })],
      [{ order_id: 'o9', n: '3', contract_order_id: 9, chain_id: 84532, is_seller: false, title: 'Audio' }],
      [{ slug: 'clean-data-k1', title: 'Clean data', n: '2' }],
      4,
      0
    );
    expect(items.map((i) => i.kind)).toEqual(['admin_disputes', 'dispute', 'message', 'proposals']);
    expect(items.find((i) => i.kind === 'message')).toMatchObject({ count: 3, href: '/orders?tab=buyer&order=o9', chainId: 84532 });
    expect(items.find((i) => i.kind === 'proposals')?.href).toBe('/requests/clean-data-k1');
    expect(total).toBe(4 + 1 + 3 + 2);
  });

  it('ignores orders where the user has nothing to do', () => {
    // The buyer waits while the seller works; the seller waits during the review window.
    const rows = [order({ buyer_id: ME, seller_id: 's' }), order({ status: 'DELIVERED', auto_release_deadline: null })];
    expect(buildActivity(ME, rows, [], [], 0, 10).total).toBe(0);
  });
});
