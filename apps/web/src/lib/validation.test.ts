import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  isSafeHttpUrl,
  isSafeImageRef,
  validateMessage,
  validateProfileInput,
  validateServiceInput,
} from './validation';

const validService = {
  title: 'Transcripción de audio',
  description: 'Transcripción manual en español.',
  category: 'ai_data',
  priceUsdc: '20.00',
  deliveryDays: 2,
};

describe('isSafeHttpUrl', () => {
  it.each(['https://example.com/file.zip', 'http://localhost:3000/x'])('accepts %s', (u) => {
    expect(isSafeHttpUrl(u)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com',
    '//evil.example',
    'not a url',
    '',
    undefined,
    null,
    123,
  ])('rejects %s', (u) => {
    expect(isSafeHttpUrl(u as unknown)).toBe(false);
  });

  it('rejects absurdly long URLs', () => {
    expect(isSafeHttpUrl('https://example.com/' + 'a'.repeat(LIMITS.urlMax))).toBe(false);
  });
});

describe('isSafeImageRef', () => {
  it('accepts same-origin paths and https URLs', () => {
    expect(isSafeImageRef('/uploads/transcripcion-audio-es.jpg')).toBe(true);
    expect(isSafeImageRef('https://cdn.example.com/a.png')).toBe(true);
  });
  it('rejects traversal and scripts', () => {
    expect(isSafeImageRef('/uploads/../../etc/passwd')).toBe(false);
    expect(isSafeImageRef('javascript:alert(1)')).toBe(false);
    expect(isSafeImageRef('/a b')).toBe(false);
  });
});

describe('validateServiceInput', () => {
  it('accepts a valid digital service and normalises the price to 2 decimals', () => {
    const r = validateServiceInput({ ...validService, priceUsdc: 20 });
    expect(r).toMatchObject({ ok: true, value: { priceUsdc: '20.00', deliveryDays: 2, deliveryType: 'digital', country: null } });
  });

  it('rejects unknown categories', () => {
    expect(validateServiceInput({ ...validService, category: 'drugs' })).toMatchObject({ ok: false });
  });

  it.each([0, -5, 0.5, 10_001, 'abc', NaN, Infinity, ''])('rejects price %s', (priceUsdc) => {
    expect(validateServiceInput({ ...validService, priceUsdc })).toMatchObject({ ok: false });
  });

  it('rejects more than 2 decimals', () => {
    expect(validateServiceInput({ ...validService, priceUsdc: '10.123' })).toMatchObject({ ok: false });
  });

  it.each([0, -1, 366, 1.5, 'x', null])('rejects deliveryDays %s (the contract caps at 365)', (deliveryDays) => {
    expect(validateServiceInput({ ...validService, deliveryDays })).toMatchObject({ ok: false });
  });

  it('accepts the contract limits exactly', () => {
    expect(validateServiceInput({ ...validService, deliveryDays: 365, priceUsdc: '10000' })).toMatchObject({ ok: true });
  });

  it('rejects missing, blank and oversized text', () => {
    expect(validateServiceInput({ ...validService, title: '   ' })).toMatchObject({ ok: false });
    expect(validateServiceInput({ ...validService, title: 'x'.repeat(LIMITS.titleMax + 1) })).toMatchObject({ ok: false });
    expect(validateServiceInput({ ...validService, description: 'x'.repeat(LIMITS.descriptionMax + 1) })).toMatchObject({ ok: false });
    expect(validateServiceInput({ ...validService, description: undefined })).toMatchObject({ ok: false });
  });

  it('rejects unsafe cover images and bad delivery types', () => {
    expect(validateServiceInput({ ...validService, coverImageUrl: 'javascript:alert(1)' })).toMatchObject({ ok: false });
    expect(validateServiceInput({ ...validService, deliveryType: 'teleport' })).toMatchObject({ ok: false });
  });

  it('keeps location fields for in-person services', () => {
    const r = validateServiceInput({ ...validService, deliveryType: 'in_person', country: 'Uruguay', city: 'Montevideo' });
    expect(r).toMatchObject({ ok: true, value: { country: 'Uruguay', city: 'Montevideo' } });
  });
});

describe('validateProfileInput', () => {
  it('accepts partial updates', () => {
    expect(validateProfileInput({ displayName: ' Ana ' })).toEqual({ ok: true, value: { displayName: 'Ana' } });
    expect(validateProfileInput({})).toEqual({ ok: true, value: {} });
  });

  it('normalises the country and rejects anything that is not 2 letters', () => {
    expect(validateProfileInput({ country: 'uy' })).toEqual({ ok: true, value: { country: 'UY' } });
    expect(validateProfileInput({ country: 'Uruguay' })).toMatchObject({ ok: false });
    expect(validateProfileInput({ country: 'U1' })).toMatchObject({ ok: false });
  });

  it('enforces length limits and safe avatar URLs', () => {
    expect(validateProfileInput({ displayName: 'x'.repeat(LIMITS.displayNameMax + 1) })).toMatchObject({ ok: false });
    expect(validateProfileInput({ bio: 'x'.repeat(LIMITS.bioMax + 1) })).toMatchObject({ ok: false });
    expect(validateProfileInput({ avatarUrl: 'javascript:alert(1)' })).toMatchObject({ ok: false });
  });
});

describe('validateMessage', () => {
  it('trims and accepts normal messages', () => {
    expect(validateMessage('  hola  ')).toEqual({ ok: true, value: 'hola' });
  });
  it('rejects empty, non-string and oversized messages', () => {
    expect(validateMessage('   ')).toMatchObject({ ok: false });
    expect(validateMessage({})).toMatchObject({ ok: false });
    expect(validateMessage('x'.repeat(LIMITS.messageMax + 1))).toMatchObject({ ok: false });
  });
});
