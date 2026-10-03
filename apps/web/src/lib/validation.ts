import { MARKETPLACE_CATEGORIES } from '@mercadopleis/types';

// Server-side input validation for user-supplied content. Pure functions so they can be unit tested.

export const LIMITS = {
  titleMax: 120,
  descriptionMax: 5000,
  priceMin: 1,
  priceMax: 10_000,
  deliveryDaysMax: 365, // the escrow contract rejects anything above 365 days
  displayNameMax: 50,
  bioMax: 500,
  messageMax: 4000,
  reasonMax: 2000,
  reviewMax: 2000,
  urlMax: 2048,
  placeMax: 120,
} as const;

const CATEGORY_IDS = new Set<string>(MARKETPLACE_CATEGORIES.map((c) => c.id));
const DELIVERY_TYPES = new Set(['digital', 'in_person', 'both']);

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Only absolute http(s) URLs. Blocks javascript:, data:, file: and friends. */
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > LIMITS.urlMax) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Accepts same-origin relative image paths (e.g. /uploads/x.jpg) or safe http(s) URLs. */
export function isSafeImageRef(value: unknown): value is string {
  if (typeof value === 'string' && /^\/[A-Za-z0-9._\-/]+$/.test(value) && !value.includes('..') && value.length <= LIMITS.urlMax) return true;
  return isSafeHttpUrl(value);
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
};

const optionalText = (v: unknown, max: number): Result<string | null> => {
  if (v === undefined || v === null || v === '') return { ok: true, value: null };
  const t = text(v, max);
  return t === null ? { ok: false, error: `Text is too long (max ${max} characters)` } : { ok: true, value: t };
};

export interface ServiceInput {
  title: string;
  description: string;
  category: string;
  priceUsdc: string;
  deliveryDays: number;
  deliveryType: 'digital' | 'in_person' | 'both';
  coverImageUrl: string | null;
  country: string | null;
  city: string | null;
  locality: string | null;
  addressOrReference: string | null;
}

export function validateServiceInput(body: Record<string, unknown>): Result<ServiceInput> {
  const title = text(body.title, LIMITS.titleMax);
  if (!title) return { ok: false, error: `title is required (max ${LIMITS.titleMax} characters)` };

  const description = text(body.description, LIMITS.descriptionMax);
  if (!description) return { ok: false, error: `description is required (max ${LIMITS.descriptionMax} characters)` };

  if (typeof body.category !== 'string' || !CATEGORY_IDS.has(body.category)) {
    return { ok: false, error: 'category is not a valid marketplace category' };
  }

  const price = Number(body.priceUsdc);
  if (!Number.isFinite(price) || price < LIMITS.priceMin || price > LIMITS.priceMax) {
    return { ok: false, error: `priceUsdc must be between ${LIMITS.priceMin} and ${LIMITS.priceMax} USDC` };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(String(body.priceUsdc).trim())) {
    return { ok: false, error: 'priceUsdc supports at most 2 decimals' };
  }

  const days = Number(body.deliveryDays);
  if (!Number.isInteger(days) || days < 1 || days > LIMITS.deliveryDaysMax) {
    return { ok: false, error: `deliveryDays must be a whole number between 1 and ${LIMITS.deliveryDaysMax}` };
  }

  const deliveryType = (body.deliveryType ?? 'digital') as string;
  if (!DELIVERY_TYPES.has(deliveryType)) return { ok: false, error: 'deliveryType must be digital, in_person or both' };

  let cover: string | null = null;
  if (body.coverImageUrl !== undefined && body.coverImageUrl !== null && body.coverImageUrl !== '') {
    if (!isSafeImageRef(body.coverImageUrl)) return { ok: false, error: 'coverImageUrl must be an http(s) URL or a /path' };
    cover = body.coverImageUrl as string;
  }

  const place = (key: 'country' | 'city' | 'locality' | 'addressOrReference') => optionalText(body[key], LIMITS.placeMax);
  const [country, city, locality, address] = [place('country'), place('city'), place('locality'), place('addressOrReference')];
  for (const r of [country, city, locality, address]) if (!r.ok) return { ok: false, error: r.error };

  return {
    ok: true,
    value: {
      title,
      description,
      category: body.category,
      priceUsdc: price.toFixed(2),
      deliveryDays: days,
      deliveryType: deliveryType as ServiceInput['deliveryType'],
      coverImageUrl: cover,
      country: (country as { value: string | null }).value,
      city: (city as { value: string | null }).value,
      locality: (locality as { value: string | null }).value,
      addressOrReference: (address as { value: string | null }).value,
    },
  };
}

export interface ProfileInput {
  displayName?: string;
  bio?: string;
  country?: string;
  avatarUrl?: string;
}

export function validateProfileInput(body: Record<string, unknown>): Result<ProfileInput> {
  const out: ProfileInput = {};

  if (body.displayName !== undefined && body.displayName !== '') {
    const v = text(body.displayName, LIMITS.displayNameMax);
    if (!v) return { ok: false, error: `displayName must be 1-${LIMITS.displayNameMax} characters` };
    out.displayName = v;
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string' || body.bio.length > LIMITS.bioMax) {
      return { ok: false, error: `bio must be at most ${LIMITS.bioMax} characters` };
    }
    out.bio = body.bio.trim();
  }
  if (body.country !== undefined && body.country !== '') {
    if (typeof body.country !== 'string' || !/^[A-Za-z]{2}$/.test(body.country)) {
      return { ok: false, error: 'country must be a 2-letter ISO code' };
    }
    out.country = body.country.toUpperCase();
  }
  if (body.avatarUrl !== undefined && body.avatarUrl !== null && body.avatarUrl !== '') {
    if (!isSafeImageRef(body.avatarUrl)) return { ok: false, error: 'avatarUrl must be an http(s) URL or a /path' };
    out.avatarUrl = body.avatarUrl as string;
  }
  return { ok: true, value: out };
}

export function validateMessage(content: unknown): Result<string> {
  const t = text(content, LIMITS.messageMax);
  return t ? { ok: true, value: t } : { ok: false, error: `Message must be 1-${LIMITS.messageMax} characters` };
}

const usdcAmount = (v: unknown, field: string): Result<string> => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < LIMITS.priceMin || n > LIMITS.priceMax) {
    return { ok: false, error: `${field} must be between ${LIMITS.priceMin} and ${LIMITS.priceMax} USDC` };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(String(v).trim())) return { ok: false, error: `${field} supports at most 2 decimals` };
  return { ok: true, value: n.toFixed(2) };
};

const wholeDays = (v: unknown): Result<number> => {
  const d = Number(v);
  return Number.isInteger(d) && d >= 1 && d <= LIMITS.deliveryDaysMax
    ? { ok: true, value: d }
    : { ok: false, error: `deliveryDays must be a whole number between 1 and ${LIMITS.deliveryDaysMax}` };
};

export interface RequestInput {
  title: string;
  description: string;
  category: string;
  budgetUsdc: string;
  deliveryDays: number;
}

/** A task posted by a buyer (person or agent) to receive proposals. */
export function validateRequestInput(body: Record<string, unknown>): Result<RequestInput> {
  const title = text(body.title, LIMITS.titleMax);
  if (!title) return { ok: false, error: `title is required (max ${LIMITS.titleMax} characters)` };
  const description = text(body.description, LIMITS.descriptionMax);
  if (!description) return { ok: false, error: `description is required (max ${LIMITS.descriptionMax} characters)` };
  if (typeof body.category !== 'string' || !CATEGORY_IDS.has(body.category)) {
    return { ok: false, error: 'category is not a valid marketplace category' };
  }
  const budget = usdcAmount(body.budgetUsdc, 'budgetUsdc');
  if (!budget.ok) return budget;
  const days = wholeDays(body.deliveryDays);
  if (!days.ok) return days;
  return { ok: true, value: { title, description, category: body.category, budgetUsdc: budget.value, deliveryDays: days.value } };
}

export interface MilestoneInput {
  title: string;
  amountUsdc: string;
  deliveryDays: number;
}

export interface ProposalInput {
  priceUsdc: string;
  deliveryDays: number;
  message: string;
  /** Optional phases, each funded and approved as its own escrow order. Their amounts add up to priceUsdc. */
  milestones: MilestoneInput[] | null;
}

export const MILESTONES_MIN = 2;
export const MILESTONES_MAX = 10;

/**
 * A seller's answer to a request: price, delivery time and how they will do it. With milestones, the price and
 * delivery time are derived from them (sum of amounts, sum of days), so the totals can never disagree.
 */
export function validateProposalInput(body: Record<string, unknown>): Result<ProposalInput> {
  const message = text(body.message, LIMITS.messageMax);
  if (!message) return { ok: false, error: `message is required (max ${LIMITS.messageMax} characters)` };

  if (body.milestones !== undefined && body.milestones !== null) {
    if (!Array.isArray(body.milestones) || body.milestones.length < MILESTONES_MIN || body.milestones.length > MILESTONES_MAX) {
      return { ok: false, error: `milestones must be a list of ${MILESTONES_MIN} to ${MILESTONES_MAX} phases` };
    }
    const milestones: MilestoneInput[] = [];
    for (const [i, raw] of (body.milestones as Record<string, unknown>[]).entries()) {
      const title = text(raw?.title, LIMITS.titleMax);
      if (!title) return { ok: false, error: `milestone ${i + 1}: title is required (max ${LIMITS.titleMax} characters)` };
      const amount = usdcAmount(raw?.amountUsdc, `milestone ${i + 1} amountUsdc`);
      if (!amount.ok) return amount;
      const days = wholeDays(raw?.deliveryDays);
      if (!days.ok) return { ok: false, error: `milestone ${i + 1}: ${days.error}` };
      milestones.push({ title, amountUsdc: amount.value, deliveryDays: days.value });
    }
    // Integer cents avoid floating point drift when adding amounts.
    const totalCents = milestones.reduce((sum, m) => sum + Math.round(Number(m.amountUsdc) * 100), 0);
    if (totalCents > LIMITS.priceMax * 100) return { ok: false, error: `the milestones add up to more than ${LIMITS.priceMax} USDC` };
    const totalDays = milestones.reduce((sum, m) => sum + m.deliveryDays, 0);
    if (totalDays > LIMITS.deliveryDaysMax) return { ok: false, error: `the milestones add up to more than ${LIMITS.deliveryDaysMax} days` };
    return { ok: true, value: { priceUsdc: (totalCents / 100).toFixed(2), deliveryDays: totalDays, message, milestones } };
  }

  const price = usdcAmount(body.priceUsdc, 'priceUsdc');
  if (!price.ok) return price;
  const days = wholeDays(body.deliveryDays);
  if (!days.ok) return days;
  return { ok: true, value: { priceUsdc: price.value, deliveryDays: days.value, message, milestones: null } };
}
