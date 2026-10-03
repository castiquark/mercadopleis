import { NextRequest, NextResponse } from 'next/server';
import { db, orders, requests, services } from '@mercadopleis/database';
import { and, eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { visibleProposals } from '@/lib/requests';
import { findRequest } from '@/lib/requestsDb';

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

    let order: { contractOrderId: number | null; chainId: number; status: string } | null = null;
    if (canSeeAward && awarded.serviceId) {
      const o = await db.query.orders.findFirst({
        where: and(eq(orders.serviceId, awarded.serviceId), eq(orders.buyerId, found.buyerId)),
        columns: { contractOrderId: true, chainId: true, status: true },
      });
      order = o ?? null;
    }

    return NextResponse.json({
      request: {
        ...rest,
        proposalCount: proposals.length,
        isOwner: viewer?.id === found.buyerId,
      },
      proposals: visible,
      award: canSeeAward ? { proposalId: awarded.id, serviceSlug: awarded.service?.slug ?? null, order } : null,
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
    if (awarded?.serviceId) {
      const funded = await db.query.orders.findFirst({ where: eq(orders.serviceId, awarded.serviceId), columns: { id: true } });
      if (funded) {
        return NextResponse.json({ error: 'An order was already funded for this request; manage it from your orders' }, { status: 409 });
      }
    }

    await db.transaction(async (tx: any) => {
      await tx.update(requests).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(requests.id, found.id));
      if (awarded?.serviceId) {
        await tx.update(services).set({ isActive: false, updatedAt: new Date() }).where(eq(services.id, awarded.serviceId));
      }
    });
    return NextResponse.json({ request: { ...found, status: 'CANCELLED' } });
  } catch (err) {
    console.error('Error cancelling request:', err);
    return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 });
  }
}
