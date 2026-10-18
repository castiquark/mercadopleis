import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq, lt } from 'drizzle-orm';
import { db, telegramLinks, telegramLinkCodes } from '@mercadopleis/database';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { telegramConfigured } from '@/lib/notify/telegram';
import { asLang } from '@/lib/notify/messages';

const CODE_TTL_MS = 15 * 60 * 1000;

/** Creates a one-time t.me link; opening it and pressing Start in Telegram links that chat to this user. */
export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!telegramConfigured() || !bot) {
    return NextResponse.json({ error: 'Telegram notifications are not enabled on this site' }, { status: 503 });
  }
  const limited = await enforceRateLimit([{ name: 'notify:telegram', id: authUser.id, limit: 10, windowSeconds: 3600 }]);
  if (limited) return limited;

  const { lang } = (await request.json().catch(() => ({}))) ?? {};
  const code = crypto.randomBytes(18).toString('base64url');
  await db.delete(telegramLinkCodes).where(lt(telegramLinkCodes.expiresAt, new Date()));
  await db.insert(telegramLinkCodes).values({ code, userId: authUser.id, lang: asLang(lang), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return NextResponse.json({ url: `https://t.me/${bot}?start=${code}`, expiresInSeconds: CODE_TTL_MS / 1000 });
}

/** Unlinks Telegram. */
export async function DELETE(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await db.delete(telegramLinks).where(eq(telegramLinks.userId, authUser.id));
  return NextResponse.json({ ok: true });
}
