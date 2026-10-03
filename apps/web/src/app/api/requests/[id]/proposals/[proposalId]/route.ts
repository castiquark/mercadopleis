import { NextRequest, NextResponse } from 'next/server';
import { db, requestProposals, requests, services, users } from '@mercadopleis/database';
import { and, eq, ne } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { servicesFromProposal } from '@/lib/requests';
import { findRequest } from '@/lib/requestsDb';

/**
 * { action: 'accept' } — the buyer accepts a proposal: it becomes an unlisted service with the agreed price and
 * delivery time, the other proposals are rejected and the request is awarded. The buyer then funds the escrow
 * order against that service like any other (the API checks the seller wallet and the exact amount on-chain).
 * { action: 'withdraw' } — the seller withdraws a pending proposal.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  if (action !== 'accept' && action !== 'withdraw') {
    return NextResponse.json({ error: "action must be 'accept' or 'withdraw'" }, { status: 400 });
  }

  try {
    const { id, proposalId } = await params;
    const found = await findRequest(id);
    if (!found) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    const proposal = found.proposals.find((p) => p.id === proposalId);
    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

    if (action === 'withdraw') {
      if (proposal.sellerId !== authUser.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (proposal.status !== 'PENDING') return NextResponse.json({ error: `The proposal is ${proposal.status.toLowerCase()}` }, { status: 409 });
      const [saved] = await db
        .update(requestProposals)
        .set({ status: 'WITHDRAWN', updatedAt: new Date() })
        .where(eq(requestProposals.id, proposal.id))
        .returning();
      return NextResponse.json({ proposal: saved });
    }

    if (found.buyerId !== authUser.id) return NextResponse.json({ error: 'Only the buyer can accept a proposal' }, { status: 403 });
    if (found.status !== 'OPEN') return NextResponse.json({ error: 'This request is no longer open' }, { status: 409 });
    if (proposal.status !== 'PENDING') return NextResponse.json({ error: `The proposal is ${proposal.status.toLowerCase()}` }, { status: 409 });

    const seller = await db.query.users.findFirst({ where: eq(users.id, proposal.sellerId), columns: { walletAddress: true } });
    if (!seller?.walletAddress) return NextResponse.json({ error: 'The seller has no wallet on file' }, { status: 409 });

    type Created = { id: string; slug: string; priceUsdc: string; deliveryDays: number; milestoneIndex: number | null };
    const result: Created[] | null = await db.transaction(async (tx: any) => {
      // Guard against two accepts racing: only one transaction can move the request out of OPEN.
      const [claimed] = await tx
        .update(requests)
        .set({ status: 'AWARDED', awardedProposalId: proposal.id, updatedAt: new Date() })
        .where(and(eq(requests.id, found.id), eq(requests.status, 'OPEN')))
        .returning({ id: requests.id });
      if (!claimed) return null;

      const created = await tx.insert(services).values(servicesFromProposal(found, proposal, proposal.sellerId)).returning();
      await tx
        .update(requestProposals)
        .set({ status: 'ACCEPTED', serviceId: created[0].id, updatedAt: new Date() })
        .where(eq(requestProposals.id, proposal.id));
      await tx
        .update(requestProposals)
        .set({ status: 'REJECTED', updatedAt: new Date() })
        .where(and(eq(requestProposals.requestId, found.id), ne(requestProposals.id, proposal.id), eq(requestProposals.status, 'PENDING')));
      return created as Created[];
    });

    if (!result) return NextResponse.json({ error: 'This request was already awarded' }, { status: 409 });

    return NextResponse.json({
      accepted: true,
      // First (or only) phase, kept for clients that fund a single service.
      service: { id: result[0].id, slug: result[0].slug, priceUsdc: result[0].priceUsdc, deliveryDays: result[0].deliveryDays },
      phases: result.map((s, i) => ({ index: s.milestoneIndex ?? i + 1, slug: s.slug, priceUsdc: s.priceUsdc, deliveryDays: s.deliveryDays })),
      seller: { walletAddress: seller.walletAddress },
      next:
        result.length > 1
          ? 'Fund each phase as its own escrow order, in order: fund phase 1, approve it, then fund the next.'
          : 'Fund the escrow order for this service (web checkout, or create_order in the MCP server with this slug).',
    });
  } catch (err) {
    console.error('Error updating proposal:', err);
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }
}
