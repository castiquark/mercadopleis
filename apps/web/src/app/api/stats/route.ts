import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@mercadopleis/database';
import { ADMIN_WALLET_ADDRESS } from '@mercadopleis/types';
import { currentEscrow, knownEscrows } from '@/lib/networks';

export const dynamic = 'force-dynamic';

const MAINNET = 8453;
const rowsOf = (res: any): any[] => (Array.isArray(res) ? res : res?.rows ?? []);

// Public traction numbers ("Operation 100"): orders on the Base Mainnet escrows (v3 and the v2 history), with the ones the operator
// funded counted apart so they are never presented as outside demand. Every order is an on-chain event anyone can check.
export async function GET() {
  try {
    const [e1, e2] = [...knownEscrows(MAINNET).map((a) => a.toLowerCase()), ''];
    const [orderRes, catalogRes] = await Promise.all([
      db.execute(sql`
        WITH o AS (
          SELECT o.status, o.gross_amount_usdc::numeric AS gross,
                 (b.role = 'ADMIN' OR b.wallet_address = ${ADMIN_WALLET_ADDRESS}) AS by_operator
          FROM orders o JOIN users b ON b.id = o.buyer_id
          WHERE o.chain_id = ${MAINNET} AND lower(o.escrow_address) IN (${e1}, ${e2}) AND o.status <> 'CREATED'
        )
        SELECT
          count(*) FILTER (WHERE NOT by_operator) AS funded,
          count(*) FILTER (WHERE status IN ('RELEASED', 'RESOLVED') AND NOT by_operator) AS completed,
          coalesce(sum(gross) FILTER (WHERE status IN ('RELEASED', 'RESOLVED') AND NOT by_operator), 0) AS volume,
          count(*) FILTER (WHERE status = 'REFUNDED' AND NOT by_operator) AS refunded,
          count(*) FILTER (WHERE by_operator) AS operator_funded,
          count(*) FILTER (WHERE status IN ('RELEASED', 'RESOLVED') AND by_operator) AS operator_completed,
          coalesce(sum(gross) FILTER (WHERE status IN ('RELEASED', 'RESOLVED') AND by_operator), 0) AS operator_volume
        FROM o
      `),
      db.execute(sql`
        SELECT
          (SELECT count(*) FROM services WHERE is_active AND is_listed) AS services,
          (SELECT count(DISTINCT seller_id) FROM services WHERE is_active AND is_listed) AS sellers,
          (SELECT count(*) FROM users WHERE founding_seller_number IS NOT NULL) AS founding_sellers
      `),
    ]);
    const o = rowsOf(orderRes)[0] ?? {};
    const c = rowsOf(catalogRes)[0] ?? {};
    const n = (v: unknown) => Number(v ?? 0);
    return NextResponse.json(
      {
        goal: 100,
        network: 'Base Mainnet',
        chainId: MAINNET,
        escrowContract: currentEscrow(MAINNET),
        verifyUrl: `https://basescan.org/address/${currentEscrow(MAINNET)}#events`,
        orders: { funded: n(o.funded), completed: n(o.completed), refunded: n(o.refunded), volumeUsdc: n(o.volume) },
        operator: { funded: n(o.operator_funded), completed: n(o.operator_completed), volumeUsdc: n(o.operator_volume) },
        catalog: { services: n(c.services), sellers: n(c.sellers), foundingSellers: n(c.founding_sellers) },
        updatedAt: new Date().toISOString(),
      },
      // Cached at the CDN for 5 minutes: it is public and changes slowly.
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Could not load stats' }, { status: 500 });
  }
}
