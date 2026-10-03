import { NextRequest, NextResponse } from 'next/server';
import { db, requestProposals } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { validateProposalInput } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rateLimit';
import { findRequest } from '@/lib/requestsDb';

/** Send (or update) your proposal for an open request. One proposal per seller; editable while pending. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized: sign in with your wallet to send a proposal' }, { status: 401 });

  const limited = await enforceRateLimit([{ name: 'proposals:send', id: authUser.id, limit: 30, windowSeconds: 3600 }]);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const input = validateProposalInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    const { id } = await params;
    const found = await findRequest(id);
    if (!found) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (found.buyerId === authUser.id) return NextResponse.json({ error: 'You cannot send a proposal to your own request' }, { status: 400 });
    if (found.status !== 'OPEN') return NextResponse.json({ error: 'This request is no longer taking proposals' }, { status: 409 });

    const mine = found.proposals.find((p) => p.sellerId === authUser.id);
    if (mine && mine.status !== 'PENDING' && mine.status !== 'WITHDRAWN') {
      return NextResponse.json({ error: `Your proposal is already ${mine.status.toLowerCase()}` }, { status: 409 });
    }

    const values = { ...input.value, status: 'PENDING', updatedAt: new Date() };
    const [saved] = mine
      ? await db.update(requestProposals).set(values).where(eq(requestProposals.id, mine.id)).returning()
      : await db.insert(requestProposals).values({ ...values, requestId: found.id, sellerId: authUser.id }).returning();

    return NextResponse.json({ proposal: saved }, { status: mine ? 200 : 201 });
  } catch (err) {
    console.error('Error saving proposal:', err);
    return NextResponse.json({ error: 'Failed to save proposal' }, { status: 500 });
  }
}
