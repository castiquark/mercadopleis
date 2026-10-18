// Commands the Telegram bot understands, and its replies. Pure, so it can be tested without Telegram.
import type { NotifyLang } from './messages';

export type BotCommand = { cmd: 'start'; code: string | null } | { cmd: 'stop' } | { cmd: 'other' };

const CODE = /^[A-Za-z0-9_-]{16,64}$/;

export function parseCommand(text: unknown): BotCommand {
  if (typeof text !== 'string') return { cmd: 'other' };
  const [head, arg] = text.trim().split(/\s+/, 2);
  const name = head.split('@')[0].toLowerCase(); // "/start@MyBot" in groups
  if (name === '/start') return { cmd: 'start', code: arg && CODE.test(arg) ? arg : null };
  if (name === '/stop') return { cmd: 'stop' };
  return { cmd: 'other' };
}

/** Telegram's language_code ("es", "pt-br", "en-US"...) to one of the site languages. */
export const telegramLang = (code: unknown): NotifyLang => {
  const c = typeof code === 'string' ? code.toLowerCase() : '';
  return c.startsWith('pt') ? 'pt' : c.startsWith('en') ? 'en' : 'es';
};

export const BOT_REPLIES = {
  linked: {
    es: 'Listo: este chat recibirá los avisos de Mercadopleis (entregas, pagos, mensajes y disputas). Para dejar de recibirlos, envía /stop o desvincúlalo desde tu perfil.',
    en: 'Done: this chat will get Mercadopleis notifications (deliveries, payments, messages and disputes). To stop them, send /stop or unlink it from your profile.',
    pt: 'Pronto: este chat vai receber os avisos do Mercadopleis (entregas, pagamentos, mensagens e disputas). Para parar, envie /stop ou desvincule no seu perfil.',
  },
  expired: {
    es: 'El enlace venció o ya se usó. Genera uno nuevo desde tu perfil en mercadopleis.club.',
    en: 'The link expired or was already used. Create a new one from your profile on mercadopleis.club.',
    pt: 'O link expirou ou já foi usado. Gere um novo no seu perfil em mercadopleis.club.',
  },
  help: {
    es: 'Este bot envía los avisos de Mercadopleis. Para vincularlo, abre tu perfil en mercadopleis.club y elige "Vincular Telegram".',
    en: 'This bot sends Mercadopleis notifications. To link it, open your profile on mercadopleis.club and choose "Link Telegram".',
    pt: 'Este bot envia os avisos do Mercadopleis. Para vincular, abra seu perfil em mercadopleis.club e escolha "Vincular Telegram".',
  },
  stopped: {
    es: 'Listo: este chat ya no recibirá avisos.',
    en: 'Done: this chat will no longer get notifications.',
    pt: 'Pronto: este chat não vai mais receber avisos.',
  },
} as const;
