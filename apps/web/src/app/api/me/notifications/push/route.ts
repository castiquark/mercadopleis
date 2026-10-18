import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, pushSubscriptions } from '@mercadopleis/database';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { pushConfigured } from '@/lib/notify/webpush';
import { asLang } from '@/lib/notify/messages';

const KEY = /^[A-Za-z0-9_-]{16,200}={0,2}$/;

function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1000) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Saves this browser's push subscription for the signed-in user (re-subscribing moves it to the new user). */
export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'Browser notifications are not enabled on this site' }, { status: 503 });
  const limited = await enforceRateLimit([{ name: 'notify:push', id: authUser.id, limit: 20, windowSeconds: 3600 }]);
  if (limited) return limited;

  const { endpoint, keys, lang } = (await request.json().catch(() => ({}))) ?? {};
  if (!validEndpoint(endpoint) || !KEY.test(keys?.p256dh ?? '') || !KEY.test(keys?.auth ?? '')) {
    return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
  }
  const values = { userId: authUser.id, endpoint, p256dh: keys.p256dh as string, auth: keys.auth as string, lang: asLang(lang) };
  await db
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: values.userId, p256dh: values.p256dh, auth: values.auth, lang: values.lang },
    });
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Removes this browser's subscription. */
export async function DELETE(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { endpoint } = (await request.json().catch(() => ({}))) ?? {};
  if (!validEndpoint(endpoint)) return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, authUser.id)));
  return NextResponse.json({ ok: true });
}
