// Records a notification in each user's history (header bell) and sends it through every channel they enabled
// (browser push, Telegram).
// Never throws: a failed notification must not fail the request that triggered it.
import { db, pushSubscriptions, telegramLinks, notificationLog, notifications, services, users } from '@mercadopleis/database';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { asLang, notifyText, type NotifyEvent } from './messages';
import { pushConfigured, sendPush } from './webpush';
import { telegramConfigured, sendTelegram } from './telegram';

export type { NotifyEvent } from './messages';

const TIMEOUT_MS = 5000;

/**
 * key identifies the event (e.g. "order_delivered:<orderId>"): the first call with a key sends, later ones are skipped.
 * That keeps the API routes and the on-chain indexer from announcing the same thing twice.
 */
export async function notify(userIds: (string | null | undefined)[], event: NotifyEvent, key: string): Promise<void> {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return;
  try {
    const fresh = await db.insert(notificationLog).values({ key: key.slice(0, 200) }).onConflictDoNothing().returning();
    if (!fresh.length) return;
    // History for the header bell, whatever channels the user enabled.
    await db.insert(notifications).values(ids.map((userId) => ({ userId, event })));
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 90 * 86400_000);
      await db.delete(notificationLog).where(lt(notificationLog.createdAt, cutoff));
      await db.delete(notifications).where(lt(notifications.createdAt, cutoff));
    }
    if (!pushConfigured() && !telegramConfigured()) return;

    const [subs, links]: [InferSelectModel<typeof pushSubscriptions>[], InferSelectModel<typeof telegramLinks>[]] = await Promise.all([
      pushConfigured() ? db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, ids)) : [],
      telegramConfigured() ? db.select().from(telegramLinks).where(inArray(telegramLinks.userId, ids)) : [],
    ]);

    const jobs = [
      ...subs.map(async (s) => {
        if ((await sendPush(s, notifyText(event, asLang(s.lang)))) === 'gone') {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        }
      }),
      ...links.map(async (l) => {
        if ((await sendTelegram(l.chatId, notifyText(event, asLang(l.lang)), asLang(l.lang))) === 'gone') {
          await db.delete(telegramLinks).where(and(eq(telegramLinks.userId, l.userId), eq(telegramLinks.chatId, l.chatId)));
        }
      }),
    ];
    await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, TIMEOUT_MS))]);
  } catch (err) {
    console.error('Notification error:', err);
  }
}

interface OrderLike {
  id: string;
  buyerId: string;
  sellerId: string;
  serviceId: string;
  contractOrderId: number | null;
  chainId: number | null;
}

type OrderEventType = 'order_funded' | 'order_delivered' | 'order_released' | 'order_refunded' | 'dispute_opened' | 'dispute_resolved' | 'message';

/** Notifies one or both parties of an order. `to` is who receives it; each party gets the link to its own tab. */
export async function notifyOrder(order: OrderLike, type: OrderEventType, to: ('buyer' | 'seller' | 'admins')[], key?: string) {
  try {
    const svc = await db.query.services.findFirst({ where: eq(services.id, order.serviceId), columns: { title: true } });
    const base = { orderId: order.id, contractOrderId: order.contractOrderId, chainId: order.chainId, title: svc?.title || '' };
    const k = key || `${type}:${order.id}`;
    const tasks: Promise<void>[] = [];
    if (to.includes('buyer')) tasks.push(notify([order.buyerId], { type, ...base, role: 'buyer' }, `${k}:buyer`));
    if (to.includes('seller')) tasks.push(notify([order.sellerId], { type, ...base, role: 'seller' }, `${k}:seller`));
    if (to.includes('admins')) {
      const admins: { id: string }[] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
      const ids = admins.map((a) => a.id).filter((id) => id !== order.buyerId && id !== order.sellerId);
      tasks.push(notify(ids, { type, ...base, role: 'admin' }, `${k}:admins`));
    }
    await Promise.all(tasks);
  } catch (err) {
    console.error('Order notification error:', err);
  }
}

/** Chat messages: at most one notification per order and recipient every 10 minutes. */
export function notifyMessage(order: OrderLike, senderId: string) {
  const to: ('buyer' | 'seller')[] =
    senderId === order.sellerId ? ['buyer'] : senderId === order.buyerId ? ['seller'] : ['buyer', 'seller']; // e.g. the arbitrator
  const bucket = Math.floor(Date.now() / 600_000);
  return notifyOrder(order, 'message', to, `message:${order.id}:${bucket}`);
}

/** The other party of an order, for events one side triggers (e.g. opening a dispute). */
export const counterpart = (order: OrderLike, userId: string): 'buyer' | 'seller' => (userId === order.sellerId ? 'buyer' : 'seller');
