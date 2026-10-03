import { NextRequest, NextResponse } from 'next/server';
import { db, requests, services } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { visibleProposals } from '@/lib/requests';
import { findRequest, phasesOfProposal } from '@/lib/requestsDb';

/**
 * Request detail. Everyone sees the request and how many proposals it has; the buyer sees every proposal,
 * a seller only their own. After acceptance, the buyer and the chosen seller get the service to fund.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = getAuthUserFromRequest(request);
  try {
    const { id } = await params;
    const found = await findRequest(id);
    if (!found) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { proposals, ...rest } = found as any;
    const visible = visibleProposals(found, proposals, viewer ? { id: viewer.id, role: viewer.role } : null);
    const awarded = proposals.find((p: any) => p.id === found.awardedProposalId);
    const canSeeAward = !!viewer && !!awarded && (viewer.id === found.buyerId || viewer.id === awarded.sellerId);

    const phases = canSeeAward ? await phasesOfProposal(awarded.id, found.buyerId) : [];

    return NextResponse.json({
      request: {
        ...rest,
        proposalCount: proposals.length,
        isOwner: viewer?.id === found.buyerId,
      },
      proposals: visible,
      award: canSeeAward
        ? { proposalId: awarded.id, serviceSlug: phases[0]?.serviceSlug ?? null, order: phases[0]?.order ?? null, phases }
        : null,
    });
  } catch (err) {
    console.error('Error fetching request:', err);
    return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 });
  }
}

/** The buyer can cancel a request while it is open, or after awarding it as long as no order was funded. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.status !== 'CANCELLED') {
    return NextResponse.json({ error: "Only { status: 'CANCELLED' } is supported" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const found = await findRequest(id);
    if (!found) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (found.buyerId !== authUser.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (found.status === 'CANCELLED') return NextResponse.json({ request: found });

    const awarded = found.proposals.find((p) => p.id === found.awardedProposalId);
    const phases = awarded ? await phasesOfProposal(awarded.id, found.buyerId) : [];
    if (phases.some((ph) => ph.order)) {
      return NextResponse.json({ error: 'An order was already funded for this request; manage it from your orders' }, { status: 409 });
    }

    await db.transaction(async (tx: any) => {
      await tx.update(requests).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(requests.id, found.id));
      if (awarded) {
        await tx.update(services).set({ isActive: false, updatedAt: new Date() }).where(eq(services.proposalId, awarded.id));
      }
    });
    return NextResponse.json({ request: { ...found, status: 'CANCELLED' } });
  } catch (err) {
    console.error('Error cancelling request:', err);
    return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 });
  }
}
