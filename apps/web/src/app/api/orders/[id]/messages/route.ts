import { NextRequest, NextResponse } from 'next/server';
import { db, orders, orderMessages, users } from '@mercadopleis/database';
import { eq, asc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if order exists
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!order) {
      return NextResponse.json({ messages: [] });
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
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUserFromRequest(request);
  const body = await request.json();
  const { content, senderWallet } = body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
  }

  try {
    const { id } = await params;

    // Resolve sender
    let senderId = authUser?.id;
    if (!senderId && senderWallet) {
      const user = await db.query.users.findFirst({
        where: eq(users.walletAddress, senderWallet.toLowerCase()),
      });
      if (user) senderId = user.id;
    }

    if (!senderId) {
      const defaultUser = await db.query.users.findFirst();
      senderId = defaultUser?.id;
    }

    if (!senderId) {
      return NextResponse.json({ error: 'User could not be identified' }, { status: 401 });
    }

    const [newMessage] = await db
      .insert(orderMessages)
      .values({
        orderId: id,
        senderId,
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
