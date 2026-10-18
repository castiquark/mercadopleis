import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, telegramLinks } from '@mercadopleis/database';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { pushConfigured } from '@/lib/notify/webpush';
import { telegramConfigured } from '@/lib/notify/telegram';

export const dynamic = 'force-dynamic';

// Which notification channels the site offers and whether the signed-in user linked Telegram.
// Browser push state lives in each browser (pushManager.getSubscription), so it is not returned here.
export async function GET(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const telegram = telegramConfigured() && Boolean(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
  const link = telegram
    ? await db.query.telegramLinks.findFirst({ where: eq(telegramLinks.userId, authUser.id), columns: { userId: true } })
    : null;
  return NextResponse.json(
    {
      push: { available: pushConfigured(), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null },
      telegram: { available: telegram, linked: Boolean(link) },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
