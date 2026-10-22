import { db, services } from '@mercadopleis/database';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { SERVICE_SLUG_RENAMES, serviceSlugCandidates } from './serviceSlugs';
import { currentEscrow } from '@/lib/networks';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

/** One service with its seller's public profile, for the public API and the server-rendered service page. */
export async function findPublicService(slug: string) {
  const service = await db.query.services.findFirst({
    where: inArray(services.slug, serviceSlugCandidates(slug)),
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
  return service && { ...service, slug: SERVICE_SLUG_RENAMES[service.slug] ?? service.slug };
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
    slug: SERVICE_SLUG_RENAMES[s.slug] ?? s.slug,
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
      escrowContract: currentEscrow(8453),
      feeBps: CONTRACT_CONFIG.FEE_BPS,
      reviewWindowDays: 5,
    },
  }));
  return formattedServices;
}
