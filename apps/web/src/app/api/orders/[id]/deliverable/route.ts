import { NextRequest, NextResponse } from 'next/server';
import { db, orders } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { DOWNLOAD_URL_TTL_SECONDS, createDownloadUrl, parseStorageRef } from '@/lib/storage';
import { isSafeHttpUrl } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * Returns where to fetch the deliverable of an order. Uploaded files are private: the buyer, the seller
 * and admins get a short-lived signed URL. External links (GitHub, Figma, ...) are returned as is.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await enforceRateLimit([{ name: 'deliverable:get', id: authUser.id, limit: 60, windowSeconds: 60 }]);
  if (limited) return limited;

  try {
    const { id } = await params;
    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyerId !== authUser.id && order.sellerId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reference = order.deliveryReferenceUrl;
    if (!reference) {
      return NextResponse.json({ error: 'This order has no deliverable yet' }, { status: 404 });
    }

    const key = parseStorageRef(reference);
    if (key) {
      const url = await createDownloadUrl(key);
      return NextResponse.json(
        { type: 'storage', url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS, deliveryHash: order.deliveryHash },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (isSafeHttpUrl(reference)) {
      return NextResponse.json({ type: 'external', url: reference, deliveryHash: order.deliveryHash });
    }

    return NextResponse.json({ error: 'Unsupported deliverable reference' }, { status: 422 });
  } catch (err) {
    console.error('Error resolving deliverable:', err);
    return NextResponse.json({ error: 'Could not resolve the deliverable' }, { status: 500 });
  }
}
