import { db, services } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';

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
