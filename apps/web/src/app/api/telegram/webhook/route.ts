import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt } from 'drizzle-orm';
import { db, telegramLinks, telegramLinkCodes } from '@mercadopleis/database';
import { sendTelegramText, telegramConfigured } from '@/lib/notify/telegram';
import { BOT_REPLIES, parseCommand, telegramLang } from '@/lib/notify/bot';
import { asLang } from '@/lib/notify/messages';

export const dynamic = 'force-dynamic';

const sameSecret = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Telegram calls this for every message to the bot (registered with setWebhook and a secret_token).
// It only handles /start <code> (link this chat) and /stop (unlink); anything else gets a short help text.
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!telegramConfigured() || !secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!sameSecret(request.headers.get('x-telegram-bot-api-secret-token') || '', secret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const update = await request.json().catch(() => null);
  const message = update?.message;
  const chatId = message?.chat?.id;
  // Private chats only: linking a group would show one user's orders to everyone in it.
  if (typeof chatId !== 'number' || message?.chat?.type !== 'private') return NextResponse.json({ ok: true });

  const command = parseCommand(message.text);
  let lang = telegramLang(message.from?.language_code);
  try {
    if (command.cmd === 'start' && command.code) {
      const [found] = await db
        .delete(telegramLinkCodes)
        .where(and(eq(telegramLinkCodes.code, command.code), gt(telegramLinkCodes.expiresAt, new Date())))
        .returning();
      if (found) {
        lang = asLang(found.lang);
        await db
          .insert(telegramLinks)
          .values({ userId: found.userId, chatId, lang })
          .onConflictDoUpdate({ target: telegramLinks.userId, set: { chatId, lang, linkedAt: new Date() } });
        await sendTelegramText(chatId, BOT_REPLIES.linked[lang]);
      } else {
        await sendTelegramText(chatId, BOT_REPLIES.expired[lang]);
      }
    } else if (command.cmd === 'stop') {
      await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
      await sendTelegramText(chatId, BOT_REPLIES.stopped[lang]);
    } else {
      await sendTelegramText(chatId, BOT_REPLIES.help[lang]);
    }
  } catch (err) {
    console.error('Telegram webhook error:', err);
  }
  // Always 200 so Telegram does not retry the same update.
  return NextResponse.json({ ok: true });
}
