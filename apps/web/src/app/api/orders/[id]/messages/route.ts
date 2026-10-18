import { NextRequest, NextResponse } from 'next/server';
import { db, orders, orderMessages, orderReads } from '@mercadopleis/database';
import { eq, asc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { notifyMessage } from '@/lib/notify';
import { validateMessage } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rateLimit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records that the user has seen the thread up to now (unread counts in the activity menu). Best effort. */
async function markRead(userId: string, orderId: string) {
  await db
    .insert(orderReads)
    .values({ userId, orderId, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [orderReads.userId, orderReads.orderId], set: { lastReadAt: new Date() } })
    .catch((e: unknown) => console.warn('markRead:', e));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // RBAC: Only buyer, seller, or admin can read messages
    if (order.buyerId !== authUser.id && order.sellerId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: only the buyer, the seller or an admin can read these messages' },
        { status: 403 }
      );
    }

    const messages = await db.query.orderMessages.findMany({
      where: eq(orderMessages.orderId, id),
      orderBy: [asc(orderMessages.createdAt)],
      with: {
        sender: {
          columns: {
            id: true,
            displayName: true,
            username: true,
            walletAddress: true,
          },
        },
      },
    });

    if (order.buyerId === authUser.id || order.sellerId === authUser.id) await markRead(authUser.id, id);

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.warn('Error fetching order messages:', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await enforceRateLimit([{ name: 'messages:send', id: authUser.id, limit: 30, windowSeconds: 60 }]);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const message = validateMessage(body.content);
  if (!message.ok) {
    return NextResponse.json({ error: message.error }, { status: 400 });
  }
  const content = message.value;

  try {
    const { id } = await params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // RBAC: Only buyer, seller, or admin can send messages for this order
    if (order.buyerId !== authUser.id && order.sellerId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: only the buyer, the seller or an admin can post messages here' },
        { status: 403 }
      );
    }

    const [newMessage] = await db
      .insert(orderMessages)
      .values({
        orderId: id,
        senderId: authUser.id,
        content: content.trim(),
      })
      .returning();

    await notifyMessage(order, authUser.id);

    const fullMessage = await db.query.orderMessages.findFirst({
      where: eq(orderMessages.id, newMessage.id),
      with: {
        sender: {
          columns: {
            id: true,
            displayName: true,
            username: true,
            walletAddress: true,
          },
        },
      },
    });

    if (order.buyerId === authUser.id || order.sellerId === authUser.id) await markRead(authUser.id, id);

    return NextResponse.json({ message: fullMessage });
  } catch (err: any) {
    console.error('Error posting message:', err);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}
