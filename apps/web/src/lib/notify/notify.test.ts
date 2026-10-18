import { describe, expect, it } from 'vitest';
import { notifyText, asLang, type NotifyEvent } from './messages';
import { parseCommand, telegramLang, BOT_REPLIES } from './bot';

const order = (type: any, extra: Partial<Record<string, unknown>> = {}): NotifyEvent =>
  ({ type, orderId: 'abc', contractOrderId: 12, chainId: 8453, title: 'Transcripción de 2 h', role: 'buyer', ...extra }) as NotifyEvent;

describe('notification texts', () => {
  const types = ['order_funded', 'order_delivered', 'order_released', 'order_refunded', 'dispute_opened', 'dispute_resolved', 'message'];

  it.each(['es', 'en', 'pt'] as const)('%s: every order event has a title, the order number, the service and a link to the order', (lang) => {
    for (const type of types) {
      const t = notifyText(order(type), lang);
      expect(t.title.length, type).toBeGreaterThan(3);
      expect(t.body, type).toContain('#12');
      expect(t.body, type).toContain('Transcripción de 2 h');
      expect(t.body, type).not.toMatch(/\{[nt]\}/);
      expect(t.path, type).toBe('/orders?tab=buyer&order=abc');
    }
  });

  it('marks testnet orders, links admins to the disputes panel and the seller to its own tab', () => {
    expect(notifyText(order('order_delivered', { chainId: 84532 }), 'en').title).toContain('(testnet)');
    expect(notifyText(order('order_delivered'), 'en').title).not.toContain('testnet');
    expect(notifyText(order('dispute_opened', { role: 'admin' }), 'es').path).toBe('/admin/disputes');
    expect(notifyText(order('order_funded', { role: 'seller' }), 'es').path).toBe('/orders?tab=seller&order=abc');
  });

  it('works without an on-chain order number and shortens long titles', () => {
    const t = notifyText(order('message', { contractOrderId: null, title: 'x'.repeat(200) }), 'es');
    expect(t.body).not.toContain('#');
    expect(t.body).not.toContain('{n}');
    expect(t.body.length).toBeLessThan(160);
  });

  it('proposals link to the request; the test notification links to the profile', () => {
    expect(notifyText({ type: 'proposal_received', slug: 'label-images', title: 'Etiquetar' }, 'pt').path).toBe('/requests/label-images');
    expect(notifyText({ type: 'proposal_accepted', slug: 'label-images', title: 'Etiquetar' }, 'es').body).toContain('Etiquetar');
    expect(notifyText({ type: 'test' }, 'en').path).toBe('/profile');
  });

  it('never promises an automatic release', () => {
    for (const lang of ['es', 'en', 'pt'] as const) {
      for (const type of types) expect(notifyText(order(type), lang).body).not.toMatch(/autom[aá]tic/i);
    }
  });

  it('defaults unknown languages to Spanish', () => {
    expect(asLang('pt')).toBe('pt');
    expect(asLang('fr')).toBe('es');
    expect(asLang(undefined)).toBe('es');
  });
});

describe('telegram bot commands', () => {
  it('reads /start with a link code, ignoring malformed codes', () => {
    expect(parseCommand('/start AbCdEfGhIjKlMnOpQrSt_-12')).toEqual({ cmd: 'start', code: 'AbCdEfGhIjKlMnOpQrSt_-12' });
    expect(parseCommand('/start@MercadopleisBot AbCdEfGhIjKlMnOpQrSt')).toEqual({ cmd: 'start', code: 'AbCdEfGhIjKlMnOpQrSt' });
    expect(parseCommand('/start')).toEqual({ cmd: 'start', code: null });
    expect(parseCommand('/start short')).toEqual({ cmd: 'start', code: null });
    expect(parseCommand("/start '; DROP TABLE users;--")).toEqual({ cmd: 'start', code: null });
  });

  it('reads /stop and treats anything else as other', () => {
    expect(parseCommand('/stop')).toEqual({ cmd: 'stop' });
    expect(parseCommand('hola')).toEqual({ cmd: 'other' });
    expect(parseCommand(undefined)).toEqual({ cmd: 'other' });
  });

  it('maps Telegram language codes and has every reply in the three languages', () => {
    expect(telegramLang('pt-br')).toBe('pt');
    expect(telegramLang('en-US')).toBe('en');
    expect(telegramLang('es-419')).toBe('es');
    expect(telegramLang('de')).toBe('es');
    for (const reply of Object.values(BOT_REPLIES)) for (const lang of ['es', 'en', 'pt'] as const) expect(reply[lang].length).toBeGreaterThan(10);
  });
});
