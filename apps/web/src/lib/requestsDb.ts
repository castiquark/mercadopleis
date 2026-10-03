import { db, requests } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';

export interface RequestProposalRow {
  id: string;
  requestId: string;
  sellerId: string;
  priceUsdc: string;
  deliveryDays: number;
  message: string;
  milestones: { title: string; amountUsdc: string; deliveryDays: number }[] | null;
  status: string;
  serviceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  seller: { id: string; displayName: string; walletAddress: string } | null;
  service: { slug: string } | null;
}

export interface RequestRow {
  id: string;
  buyerId: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  budgetUsdc: string;
  deliveryDays: number;
  status: string;
  awardedProposalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  buyer: { id: string; displayName: string; walletAddress: string } | null;
  proposals: RequestProposalRow[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A request with its buyer and proposals (sellers and accepted services), by UUID or slug. */
export async function findRequest(idOrSlug: string): Promise<RequestRow | undefined> {
  return db.query.requests.findFirst({
    where: UUID.test(idOrSlug) ? eq(requests.id, idOrSlug) : eq(requests.slug, idOrSlug),
    with: {
      buyer: { columns: { id: true, displayName: true, walletAddress: true } },
      proposals: {
        with: {
          seller: { columns: { id: true, displayName: true, walletAddress: true } },
          service: { columns: { slug: true } },
        },
      },
    },
  });
}

export interface PhaseRow {
  index: number;
  count: number;
  title: string;
  priceUsdc: string;
  deliveryDays: number;
  serviceSlug: string;
  order: { contractOrderId: number | null; chainId: number; status: string } | null;
}

/** The services created for an accepted proposal (one, or one per milestone) with the buyer's order for each. */
export async function phasesOfProposal(proposalId: string, buyerId: string): Promise<PhaseRow[]> {
  const { services, orders } = await import('@mercadopleis/database');
  const { and, asc, eq, inArray } = await import('drizzle-orm');
  const rows = await db.query.services.findMany({
    where: eq(services.proposalId, proposalId),
    orderBy: [asc(services.milestoneIndex)],
    columns: { id: true, slug: true, title: true, priceUsdc: true, deliveryDays: true, milestoneIndex: true, milestoneCount: true },
  });
  if (rows.length === 0) return [];
  const funded = await db.query.orders.findMany({
    where: and(inArray(orders.serviceId, rows.map((r: any) => r.id)), eq(orders.buyerId, buyerId)),
    columns: { serviceId: true, contractOrderId: true, chainId: true, status: true },
  });
  return rows.map((r: any, i: number) => {
    const o = funded.find((x: any) => x.serviceId === r.id);
    return {
      index: r.milestoneIndex ?? i + 1,
      count: r.milestoneCount ?? rows.length,
      title: r.title,
      priceUsdc: Number(r.priceUsdc).toFixed(2),
      deliveryDays: r.deliveryDays,
      serviceSlug: r.slug,
      order: o ? { contractOrderId: o.contractOrderId, chainId: o.chainId, status: o.status } : null,
    };
  });
}
