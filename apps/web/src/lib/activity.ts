// "Needs your attention" items for the header menu, built from plain rows so the rules are unit-testable.

export type ActivityKind =
  | 'deliver' // seller: an order is funded and waiting for the delivery
  | 'review' // buyer: a delivery is waiting for approval or a dispute
  | 'claim' // seller: the review window ended, the payout can be claimed
  | 'dispute' // either party: an order is in dispute
  | 'message' // unread messages from the other party
  | 'proposals' // buyer: pending proposals on an open request
  | 'admin_disputes'; // admin: open disputes to resolve

export interface ActivityItem {
  kind: ActivityKind;
  count: number;
  title: string;
  href: string;
  orderId?: string;
  contractOrderId?: number | null;
  chainId?: number;
}

export interface ActionOrderRow {
  id: string;
  contract_order_id: number | string | null;
  chain_id: number | string;
  status: string;
  auto_release_deadline: number | string | null;
  buyer_id: string;
  seller_id: string;
  title: string;
}

export interface UnreadRow {
  order_id: string;
  n: number | string;
  contract_order_id: number | string | null;
  chain_id: number | string;
  is_seller: boolean;
  title: string;
}

export interface ProposalRow {
  slug: string;
  title: string;
  n: number | string;
}

const PRIORITY: Record<ActivityKind, number> = {
  admin_disputes: 0,
  dispute: 1,
  review: 2,
  deliver: 3,
  claim: 4,
  message: 5,
  proposals: 6,
};

const orderHref = (role: 'buyer' | 'seller', orderId: string) => `/orders?tab=${role}&order=${orderId}`;
const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

export function buildActivity(
  me: string,
  orders: ActionOrderRow[],
  unread: UnreadRow[],
  proposals: ProposalRow[],
  openDisputesForAdmin: number,
  nowSeconds: number
): { total: number; items: ActivityItem[] } {
  const items: ActivityItem[] = [];

  for (const o of orders) {
    const isSeller = o.seller_id === me;
    const isBuyer = o.buyer_id === me;
    const base = { count: 1, title: o.title, orderId: o.id, contractOrderId: num(o.contract_order_id), chainId: Number(o.chain_id) };
    if (o.status === 'DISPUTED' && (isSeller || isBuyer)) {
      items.push({ ...base, kind: 'dispute', href: orderHref(isSeller ? 'seller' : 'buyer', o.id) });
    } else if (o.status === 'FUNDED' && isSeller) {
      items.push({ ...base, kind: 'deliver', href: orderHref('seller', o.id) });
    } else if (o.status === 'DELIVERED' && isBuyer) {
      items.push({ ...base, kind: 'review', href: orderHref('buyer', o.id) });
    } else if (o.status === 'DELIVERED' && isSeller) {
      const releaseAt = num(o.auto_release_deadline);
      if (releaseAt !== null && releaseAt > 0 && nowSeconds >= releaseAt) {
        items.push({ ...base, kind: 'claim', href: orderHref('seller', o.id) });
      }
    }
  }

  for (const u of unread) {
    const n = Number(u.n);
    if (n > 0) {
      items.push({
        kind: 'message',
        count: n,
        title: u.title,
        orderId: u.order_id,
        contractOrderId: num(u.contract_order_id),
        chainId: Number(u.chain_id),
        href: orderHref(u.is_seller ? 'seller' : 'buyer', u.order_id),
      });
    }
  }

  for (const p of proposals) {
    const n = Number(p.n);
    if (n > 0) items.push({ kind: 'proposals', count: n, title: p.title, href: `/requests/${p.slug}` });
  }

  if (openDisputesForAdmin > 0) {
    items.push({ kind: 'admin_disputes', count: openDisputesForAdmin, title: '', href: '/admin/disputes' });
  }

  items.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);
  return { total: items.reduce((t, i) => t + i.count, 0), items };
}
