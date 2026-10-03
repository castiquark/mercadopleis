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

type Milestone = { title: string; amountUsdc: string; deliveryDays: number };

/**
 * Unlisted services created when a proposal is accepted: one with the agreed terms, or one per milestone.
 * Each is funded as its own escrow order, so the existing on-chain checks (seller wallet and exact amount)
 * enforce exactly what the buyer accepted, phase by phase. A phase's delivery days count from its own funding.
 */
export function servicesFromProposal(
  request: { title: string; description: string; category: string; slug: string },
  proposal: { priceUsdc: string; deliveryDays: number; message: string; id: string; milestones?: Milestone[] | null },
  sellerId: string
) {
  const base = {
    sellerId,
    category: request.category,
    deliveryType: 'digital' as const,
    isActive: true,
    isListed: false,
    proposalId: proposal.id,
  };
  const slugBase = `${request.slug.slice(0, 190)}-p${proposal.id.slice(0, 8)}`;
  const description = `${request.description}

---
Accepted proposal:
${proposal.message}`;

  const phases = proposal.milestones ?? [];
  if (phases.length === 0) {
    return [
      {
        ...base,
        title: request.title.slice(0, 255),
        slug: slugBase,
        description,
        priceUsdc: proposal.priceUsdc,
        deliveryDays: proposal.deliveryDays,
        milestoneIndex: null,
        milestoneCount: null,
      },
    ];
  }
  return phases.map((m, i) => ({
    ...base,
    title: `${request.title} — ${i + 1}/${phases.length}: ${m.title}`.slice(0, 255),
    slug: `${slugBase}-m${i + 1}`,
    description: `Phase ${i + 1} of ${phases.length}: ${m.title}

${description}`,
    priceUsdc: m.amountUsdc,
    deliveryDays: m.deliveryDays,
    milestoneIndex: i + 1,
    milestoneCount: phases.length,
  }));
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
