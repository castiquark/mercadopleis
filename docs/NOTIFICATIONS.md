# Notifications

People can get notified in the browser (Web Push) and on Telegram when something happens on their orders. Both are opt-in from the profile page and both are optional for the site: a channel without its environment variables is simply not offered.

Notifications never include message contents or deliverables, only what happened and a link.

## Events

| Event | Who is notified | Source |
|---|---|---|
| Order funded | Seller | `POST /api/orders`, indexer (`OrderFunded`) |
| Delivery recorded | Buyer | `PATCH /api/orders/[id]`, indexer (`DeliverySubmitted`) |
| Payment released | Seller | `PATCH /api/orders/[id]`, indexer (`OrderReleased`) |
| Order refunded | Seller | Indexer (`OrderRefunded`) |
| Dispute opened | The other party and the admins | `POST /api/disputes`, indexer (`DisputeOpened`) |
| Dispute resolved | Buyer and seller | `POST /api/disputes/[id]/resolve`, indexer (`DisputeResolved`) |
| New message | The other party (at most one every 10 minutes per order) | `POST /api/orders/[id]/messages` |
| New proposal | Whoever posted the request | `POST /api/requests/[id]/proposals` |
| Proposal accepted | The seller | `PATCH /api/requests/[id]/proposals/[proposalId]` |

Each notification has a key (for example `order_delivered:<orderId>:buyer`) stored in `notification_log`, so an event seen by both the API and the on-chain indexer is sent once. The indexer only notifies on a real status change, so re-scanning old blocks does not announce past events. Orders on Base Sepolia are marked "(testnet)".

Every notification is also stored per recipient in `notifications` and listed under "Recent notifications" in the header bell, whether or not the person enabled push or Telegram. It stores the event, not the text, so it renders in the reader's current language. Opening the bell marks them as read; rows older than 90 days are pruned.

Code: `apps/web/src/lib/notify/` (texts in `messages.ts`, channels in `webpush.ts` and `telegram.ts`, bot commands in `bot.ts`).

## Setup

1. **Database.** Apply `packages/database/drizzle/manual/0007_notifications.sql` and `0008_notification_history.sql` before deploying the code.

2. **Browser notifications.** Generate a key pair once and keep the private key secret:

   ```bash
   npx web-push generate-vapid-keys
   ```

   Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`mailto:hello@mercadopleis.club`) in the hosting environment. Changing the key pair later invalidates every existing subscription.

   On iPhone and iPad, browser notifications only work after adding the site to the Home Screen (iOS 16.4 or later); the profile page says so.

3. **Telegram.**
   1. In Telegram, talk to [@BotFather](https://t.me/BotFather), send `/newbot` and choose a name and a username ending in `bot`. BotFather gives you the token.
   2. Pick a random webhook secret (letters, numbers, `_` and `-`, up to 256 characters), for example `openssl rand -hex 32`.
   3. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (without `@`) in the hosting environment and deploy.
   4. Register the webhook once, after the deploy:

      ```bash
      curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://mercadopleis.club/api/telegram/webhook" -d "secret_token=<SECRET>" -d 'allowed_updates=["message"]'
      ```

   Linking: the profile page creates a one-time link (`t.me/<bot>?start=<code>`, valid 15 minutes). Pressing Start in Telegram sends the code to the webhook, which links that private chat to the user. `/stop` in the chat, or "Unlink" in the profile, removes it. Group chats are ignored.

## Testing

`notify.test.ts` covers the texts and the bot commands. To try the whole flow locally, run the app against a test database with the variables above; without a real bot token, Telegram sends fail (logged) and everything else keeps working. The profile page has a "Send a test notification" button.
