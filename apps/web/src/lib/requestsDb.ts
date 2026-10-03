import { db, requests } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';

export interface RequestProposalRow {
  id: string;
  requestId: string;
  sellerId: string;
  priceUsdc: string;
  deliveryDays: number;
  message: string;
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
