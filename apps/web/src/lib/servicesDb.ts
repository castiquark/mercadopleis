import { db, services } from '@mercadopleis/database';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

/** One service with its seller's public profile, for the public API and the server-rendered service page. */
export async function findPublicService(slug: string) {
  return db.query.services.findFirst({
    where: eq(services.slug, slug),
    with: {
      seller: {
        columns: {
          id: true,
          walletAddress: true,
          smartAccountAddress: true,
          displayName: true,
          username: true,
          bio: true,
          avatarUrl: true,
          country: true,
          role: true,
          foundingSellerNumber: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      // Orders are private (buyers, delivery links, hashes): never include them here.
    },
  });
}

/**
 * The public catalog page: active, listed services (unlisted ones come from accepted request proposals and are
 * payable by slug only) with the extra `filters`, Founding Sellers first, with price and settlement details.
 * Used by GET /api/services and by the server-rendered home page.
 */
export async function listPublicServices(filters: (SQL | undefined)[] = [], limit = 20, offset = 0) {
  const queriedServices = await db.query.services.findMany({
    where: and(eq(services.isActive, true), eq(services.isListed, true), ...filters),
    // Founding Sellers first (false sorts before true), then newest first.
    orderBy: [sql`(SELECT u.founding_seller_number IS NULL FROM users u WHERE u.id = ${services.sellerId})`, desc(services.createdAt)],
    limit,
    offset,
    with: {
      seller: {
        columns: {
          id: true,
          walletAddress: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          foundingSellerNumber: true,
        },
      },
    },
  });

  const formattedServices = queriedServices.map((s: any) => ({
    ...s,
    price: {
      amount: s.priceUsdc,
      currency: 'USDC',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
    },
    settlement: {
      network: 'Base',
      chainId: 8453,
      method: 'smart_contract_escrow',
      escrowContract: ESCROW_ADDRESSES[8453],
      feeBps: CONTRACT_CONFIG.FEE_BPS,
      reviewWindowDays: 5,
    },
  }));
  return formattedServices;
}
