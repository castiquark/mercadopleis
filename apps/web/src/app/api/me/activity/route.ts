import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@mercadopleis/database';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { buildActivity, type ActionOrderRow, type ProposalRow, type UnreadRow } from '@/lib/activity';

export const dynamic = 'force-dynamic';

const rowsOf = (res: any): any[] => (Array.isArray(res) ? res : res?.rows ?? []);

// What needs the signed-in user's attention: orders to deliver, review or claim, disputes, unread messages and
// proposals on their open requests, plus the latest notifications they received (history in the bell).
// Polled by the header, so it is a few small indexed queries.
export async function GET(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await enforceRateLimit([{ name: 'activity:user', id: authUser.id, limit: 30, windowSeconds: 60 }]);
  if (limited) return limited;

  try {
    const me = authUser.id;
    const [orderRes, unreadRes, proposalRes, disputeRes, historyRes, unseenRes] = await Promise.all([
      db.execute(sql`
        SELECT o.id, o.contract_order_id, o.chain_id, o.status, o.auto_release_deadline, o.buyer_id, o.seller_id, s.title
        FROM orders o JOIN services s ON s.id = o.service_id
        WHERE (o.seller_id = ${me} AND o.status IN ('FUNDED', 'DELIVERED'))
           OR (o.buyer_id = ${me} AND o.status = 'DELIVERED')
           OR ((o.buyer_id = ${me} OR o.seller_id = ${me}) AND o.status = 'DISPUTED')
        ORDER BY o.updated_at DESC
        LIMIT 50
      `),
      db.execute(sql`
        SELECT m.order_id, count(*) AS n, o.contract_order_id, o.chain_id, (o.seller_id = ${me}) AS is_seller, s.title
        FROM order_messages m
        JOIN orders o ON o.id = m.order_id
        JOIN services s ON s.id = o.service_id
        LEFT JOIN order_reads r ON r.order_id = m.order_id AND r.user_id = ${me}
        WHERE (o.buyer_id = ${me} OR o.seller_id = ${me})
          AND m.sender_id <> ${me}
          AND m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
        GROUP BY m.order_id, o.contract_order_id, o.chain_id, o.seller_id, s.title
        LIMIT 50
      `),
      db.execute(sql`
        SELECT r.slug, r.title, count(*) AS n
        FROM request_proposals p JOIN requests r ON r.id = p.request_id
        WHERE r.buyer_id = ${me} AND r.status = 'OPEN' AND p.status = 'PENDING'
        GROUP BY r.slug, r.title
        LIMIT 50
      `),
      authUser.role === 'ADMIN'
        ? db.execute(sql`SELECT count(*) AS n FROM disputes WHERE status = 'OPEN'`)
        : Promise.resolve([{ n: 0 }]),
      db.execute(sql`
        SELECT id, event, created_at, read_at FROM notifications
        WHERE user_id = ${me} ORDER BY created_at DESC LIMIT 15
      `),
      db.execute(sql`SELECT count(*) AS n FROM notifications WHERE user_id = ${me} AND read_at IS NULL`),
    ]);

    const activity = buildActivity(
      me,
      rowsOf(orderRes) as ActionOrderRow[],
      rowsOf(unreadRes) as UnreadRow[],
      rowsOf(proposalRes) as ProposalRow[],
      Number(rowsOf(disputeRes)[0]?.n ?? 0),
      Math.floor(Date.now() / 1000)
    );
    const notifications = rowsOf(historyRes).map((r) => ({
      id: r.id as string,
      event: r.event,
      createdAt: new Date(r.created_at).toISOString(),
      read: r.read_at != null,
    }));
    const unreadNotifications = Number(rowsOf(unseenRes)[0]?.n ?? 0);
    return NextResponse.json(
      { ...activity, total: activity.total + unreadNotifications, notifications, unreadNotifications },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Activity error:', error);
    return NextResponse.json({ error: 'Could not load activity' }, { status: 500 });
  }
}
