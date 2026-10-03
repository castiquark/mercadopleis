import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@mercadopleis/database';

export interface RateLimitRule {
  /** Short stable name of the bucket, e.g. "services:create". */
  name: string;
  /** Who is being limited: a user id, wallet address or IP. */
  id: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfter: number;
}

/** Best-effort client IP. Netlify sets x-nf-client-connection-ip; x-forwarded-for is the fallback. */
export function getClientIp(request: Request): string {
  const nf = request.headers.get('x-nf-client-connection-ip');
  if (nf) return nf.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

const rowsOf = (res: any): any[] => (Array.isArray(res) ? res : res?.rows ?? []);

/**
 * Atomically increments a fixed-window counter in Postgres and reports whether the caller is over the limit.
 * Fails open (allows the request) if the database is unavailable, so a limiter problem never takes the API down.
 */
export async function checkRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  const key = `${rule.name}:${rule.id}`.slice(0, 200);
  const w = rule.windowSeconds;
  try {
    const res = await db.execute(sql`
      INSERT INTO rate_limits (key, window_start, count)
      VALUES (${key}, to_timestamp(floor(extract(epoch from now()) / ${w}) * ${w}), 1)
      ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count, extract(epoch from (window_start + (${w} * interval '1 second') - now())) AS retry_after
    `);
    const row = rowsOf(res)[0];
    const count = Number(row?.count ?? 1);
    const retryAfter = Math.max(1, Math.ceil(Number(row?.retry_after ?? w)));

    // Opportunistic cleanup of expired windows (about 1 in 200 calls).
    if (Math.random() < 0.005) {
      db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '2 hours'`).catch(() => undefined);
    }

    return { allowed: count <= rule.limit, count, retryAfter };
  } catch (err) {
    console.error('[rate-limit] failing open:', err instanceof Error ? err.message : err);
    return { allowed: true, count: 0, retryAfter: 0 };
  }
}

/** Applies several rules; returns a 429 response for the first one exceeded, or null when all pass. */
export async function enforceRateLimit(rules: RateLimitRule[]): Promise<NextResponse | null> {
  for (const rule of rules) {
    const r = await checkRateLimit(rule);
    if (!r.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.', retryAfterSeconds: r.retryAfter },
        { status: 429, headers: { 'Retry-After': String(r.retryAfter) } }
      );
    }
  }
  return null;
}
