import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { db, users } from '@mercadopleis/database';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const MAX = 25;
const WALLET = /^0x[0-9a-f]{40}$/;

function requireAdmin(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (authUser.role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { authUser };
}

/** Founding Sellers with their number and how many listed services they have. Admin only. */
export async function GET(request: NextRequest) {
  const { error } = requireAdmin(request);
  if (error) return error;
  const res = await db.execute(sql`
    SELECT u.founding_seller_number AS number, u.wallet_address AS wallet, u.display_name AS name,
           (SELECT count(*) FROM services s WHERE s.seller_id = u.id AND s.is_active AND s.is_listed) AS services
    FROM users u WHERE u.founding_seller_number IS NOT NULL ORDER BY u.founding_seller_number
  `);
  const rows: any[] = Array.isArray(res) ? res : (res as any).rows ?? [];
  return NextResponse.json({
    max: MAX,
    sellers: rows.map((r) => ({ number: Number(r.number), wallet: r.wallet, name: r.name, services: Number(r.services) })),
  });
}

/** Gives a wallet the next free number (or the one requested). The wallet must have signed in once. */
export async function POST(request: NextRequest) {
  const { error } = requireAdmin(request);
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const wallet = String(body?.wallet ?? '').trim().toLowerCase();
  const requested = body?.number == null || body?.number === '' ? null : Number(body.number);
  if (!WALLET.test(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  if (requested !== null && (!Number.isInteger(requested) || requested < 1 || requested > MAX)) {
    return NextResponse.json({ error: `The number must be between 1 and ${MAX}` }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.walletAddress, wallet) });
  if (!user) return NextResponse.json({ error: 'No account with that wallet yet: it has to sign in on the site once' }, { status: 404 });
  if (user.foundingSellerNumber) {
    return NextResponse.json({ error: `That wallet is already Founding Seller #${user.foundingSellerNumber}` }, { status: 409 });
  }

  const taken = new Set(
    (await db.select({ n: users.foundingSellerNumber }).from(users).where(isNotNull(users.foundingSellerNumber))).map((r: { n: number | null }) => r.n)
  );
  const number = requested ?? Array.from({ length: MAX }, (_, i) => i + 1).find((n) => !taken.has(n));
  if (!number) return NextResponse.json({ error: `All ${MAX} places are taken` }, { status: 409 });
  if (taken.has(number)) return NextResponse.json({ error: `Number ${number} is already taken` }, { status: 409 });

  try {
    await db.update(users).set({ foundingSellerNumber: number, updatedAt: new Date() }).where(eq(users.id, user.id));
  } catch {
    // Unique constraint: someone took the number at the same time.
    return NextResponse.json({ error: `Number ${number} is already taken` }, { status: 409 });
  }
  return NextResponse.json({ wallet, number }, { status: 201 });
}

/** Removes the badge from a wallet. */
export async function DELETE(request: NextRequest) {
  const { error } = requireAdmin(request);
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const wallet = String(body?.wallet ?? '').trim().toLowerCase();
  if (!WALLET.test(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  await db
    .update(users)
    .set({ foundingSellerNumber: null, updatedAt: new Date() })
    .where(and(eq(users.walletAddress, wallet), isNotNull(users.foundingSellerNumber)));
  return NextResponse.json({ ok: true });
}
