// Telegram Bot API, called with fetch. Configured with TELEGRAM_BOT_TOKEN (from @BotFather).
import type { NotifyLang, NotifyText } from './messages';
import { SITE_URL } from './messages';

export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

const OPEN = { es: 'Ver en Mercadopleis', en: 'Open in Mercadopleis', pt: 'Abrir no Mercadopleis' } as const;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function telegramCall(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.ok !== false, status: res.status, description: json.description };
}

export function sendTelegramText(chatId: number, text: string) {
  return telegramCall('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
}

/** Returns 'gone' when the user blocked the bot or the chat no longer exists, so the link can be removed. */
export async function sendTelegram(chatId: number, msg: NotifyText, lang: NotifyLang): Promise<'ok' | 'gone' | 'error'> {
  const res = await telegramCall('sendMessage', {
    chat_id: chatId,
    text: `<b>${escapeHtml(msg.title)}</b>\n${escapeHtml(msg.body)}`,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: OPEN[lang], url: SITE_URL + msg.path }]] },
  });
  if (res.ok) return 'ok';
  if (res.status === 403 || (res.status === 400 && /chat not found/i.test(res.description || ''))) return 'gone';
  console.error('Telegram send failed:', res.status, res.description);
  return 'error';
}
