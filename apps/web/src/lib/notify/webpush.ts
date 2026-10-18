// Browser push (Web Push with VAPID keys). Configured with NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
import webpush from 'web-push';
import type { NotifyText } from './messages';

export const pushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@mercadopleis.club',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  ready = true;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Returns 'gone' when the browser dropped the subscription (404/410), so it can be deleted. */
export async function sendPush(sub: PushTarget, msg: NotifyText): Promise<'ok' | 'gone' | 'error'> {
  setup();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: msg.title, body: msg.body, url: msg.path }),
      { TTL: 24 * 3600, timeout: 4000, urgency: 'normal' }
    );
    return 'ok';
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) return 'gone';
    console.error('Push send failed:', err?.statusCode, err?.body || err?.message);
    return 'error';
  }
}
