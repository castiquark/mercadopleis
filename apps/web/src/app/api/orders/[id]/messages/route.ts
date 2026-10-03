import { NextRequest, NextResponse } from 'next/server';
import { db, orders, orderMessages } from '@mercadopleis/database';
import { eq, asc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { validateMessage } from '@/lib/validation';

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

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // RBAC: Only buyer, seller, or admin can read messages
    if (order.buyerId !== authUser.id && order.sellerId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: No tienes acceso a los mensajes de esta orden' },
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

  const body = await request.json().catch(() => ({}));
  const message = validateMessage(body.content);
  if (!message.ok) {
    return NextResponse.json({ error: message.error }, { status: 400 });
  }
  const content = message.value;

  try {
    const { id } = await params;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // RBAC: Only buyer, seller, or admin can send messages for this order
    if (order.buyerId !== authUser.id && order.sellerId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: No tienes autorización para enviar mensajes en esta orden' },
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

    return NextResponse.json({ message: fullMessage });
  } catch (err: any) {
    console.error('Error posting message:', err);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}
