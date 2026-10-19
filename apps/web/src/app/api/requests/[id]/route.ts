import { NextRequest, NextResponse } from 'next/server';
import { db, requests, services } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { findRequest, phasesOfProposal, requestDetail } from '@/lib/requestsDb';

/** Request detail, as much as the viewer may see (see requestDetail). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = getAuthUserFromRequest(request);
  try {
    const { id } = await params;
    const found = await findRequest(id);
    if (!found) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    return NextResponse.json(await requestDetail(found, viewer ? { id: viewer.id, role: viewer.role } : null));
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
