import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db, notifications } from '@mercadopleis/database';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

/** Marks all of the signed-in user's notifications as read (the bell was opened). */
export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, authUser.id), isNull(notifications.readAt)));
  return NextResponse.json({ ok: true });
}
