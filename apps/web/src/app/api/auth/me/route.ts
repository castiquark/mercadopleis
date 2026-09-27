import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, authUser.id),
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { displayName, bio, country, avatarUrl } = body;

    const [updated] = await db
      .update(users)
      .set({
        displayName: displayName || undefined,
        bio: bio !== undefined ? bio : undefined,
        country: country || undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, authUser.id))
      .returning();

    return NextResponse.json({ user: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
