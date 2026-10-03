// Pure helpers for the request marketplace (kept free of I/O so they can be unit tested).

export const REQUEST_STATUSES = ['OPEN', 'AWARDED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function slugify(title: string, suffix: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'request'}-${suffix}`;
}

/**
 * Terms of the unlisted service created when a proposal is accepted. The order is funded against it, so the
 * existing on-chain checks (seller wallet and exact amount) enforce exactly what the buyer accepted.
 */
export function serviceFromProposal(
  request: { title: string; description: string; category: string; slug: string },
  proposal: { priceUsdc: string; deliveryDays: number; message: string; id: string },
  sellerId: string
) {
  return {
    sellerId,
    title: request.title.slice(0, 255),
    slug: `${request.slug.slice(0, 200)}-p${proposal.id.slice(0, 8)}`,
    description: `${request.description}\n\n---\nAccepted proposal:\n${proposal.message}`,
    category: request.category,
    priceUsdc: proposal.priceUsdc,
    deliveryDays: proposal.deliveryDays,
    deliveryType: 'digital' as const,
    isActive: true,
    isListed: false,
  };
}

export type Viewer = { id: string; role: string } | null;

/**
 * What a viewer may see of the proposals: the buyer (and admins) see all of them, a seller sees only their
 * own, everyone else sees only how many there are. Prices are never public, so sellers can't undercut each other.
 */
export function visibleProposals<T extends { sellerId: string }>(request: { buyerId: string }, proposals: T[], viewer: Viewer): T[] {
  if (!viewer) return [];
  if (viewer.id === request.buyerId || viewer.role === 'ADMIN') return proposals;
  return proposals.filter((p) => p.sellerId === viewer.id);
}
