// When an agent waiting on a person should look at an order again, so it does not poll the escrow in a loop.
// All times are unix seconds from the chain (block time and the contract's effective timers), never the local clock.

export interface OrderClock {
  /** 1 Funded, 2 Delivered, 3 Released, 4 Refunded, 5 Disputed, 6 Resolved (OrderStatus in the escrow). */
  status: number;
  version: 2 | 3;
  /** Latest block timestamp. */
  now: bigint;
  deadline: bigint;
  autoRelease: bigint;
  /** v3 only: when anyone may close a dispute by timeout (0 when not disputed or on v2). */
  disputeTimeout: bigint;
  delivered: boolean;
}

export interface OrderTiming {
  /** When the next change is due: the delivery deadline, the end of the review window, or the dispute timeout. */
  expectedBy: string | null;
  /** Earliest useful time to check again. Null when nothing will change on its own (final state or your move). */
  nextCheckAfter: string | null;
  /** Set when the next step is the agent's (or anyone's) to take now. */
  actionRequired: string | null;
  polling: string;
}

const MIN_INTERVAL = 300n; // 5 min
const MAX_INTERVAL = 21_600n; // 6 h

const iso = (t: bigint) => new Date(Number(t) * 1000).toISOString();

/** A tenth of the time left, between 5 minutes and 6 hours, and never past the due time itself. */
export function nextCheck(now: bigint, due: bigint): bigint {
  const left = due > now ? due - now : 0n;
  let step = left / 10n;
  if (step < MIN_INTERVAL) step = MIN_INTERVAL;
  if (step > MAX_INTERVAL) step = MAX_INTERVAL;
  const at = now + step;
  return left > 0n && at > due ? due : at;
}

const WAIT_TIP = 'or call wait_for_order_update to block until the status changes';

export function orderTiming(c: OrderClock): OrderTiming {
  const { status, version, now, deadline, autoRelease, disputeTimeout, delivered } = c;
  const done = (polling: string): OrderTiming => ({ expectedBy: null, nextCheckAfter: null, actionRequired: null, polling });

  switch (status) {
    case 1: {
      if (now > deadline) {
        return {
          expectedBy: iso(deadline),
          nextCheckAfter: null,
          actionRequired: 'The delivery deadline passed with no delivery: claim_timeout_refund (prepare_order_action) refunds the buyer.',
          polling: 'Nothing will change on its own: the seller can no longer deliver.',
        };
      }
      const next = nextCheck(now, deadline);
      return {
        expectedBy: iso(deadline),
        nextCheckAfter: iso(next),
        actionRequired: null,
        polling: `Waiting for the seller to deliver by ${iso(deadline)}. No need to check again before ${iso(next)}, ${WAIT_TIP}.`,
      };
    }
    case 2: {
      const over = now >= autoRelease;
      return {
        expectedBy: iso(autoRelease),
        nextCheckAfter: null,
        actionRequired: over
          ? 'The review window is over: the seller can claim the payment at any time. You can still approve_delivery.'
          : `Review the delivery (get_deliverable) and approve_delivery or open_dispute before ${iso(autoRelease)}; after that the seller can claim the payment.`,
        polling: 'The next step is yours, so there is nothing to wait for.',
      };
    }
    case 5: {
      if (version === 2) {
        const next = now + MAX_INTERVAL;
        return {
          expectedBy: null,
          nextCheckAfter: iso(next),
          actionRequired: null,
          polling: `Waiting for the arbitrator to rule (no timeout on escrow v2). No need to check again before ${iso(next)}, ${WAIT_TIP}.`,
        };
      }
      // Without a delivery the default outcome (buyer refund) also needs the delivery deadline to have passed.
      const due = !delivered && deadline > disputeTimeout ? deadline : disputeTimeout;
      if (now >= due) {
        return {
          expectedBy: iso(due),
          nextCheckAfter: null,
          actionRequired: `The arbitrator did not rule in time: anyone can close the dispute with claim_dispute_timeout (${delivered ? 'the seller is paid' : 'the buyer is refunded'}).`,
          polling: 'Nothing will change on its own until someone sends claim_dispute_timeout or the arbitrator rules.',
        };
      }
      const next = nextCheck(now, due);
      return {
        expectedBy: iso(due),
        nextCheckAfter: iso(next),
        actionRequired: null,
        polling: `Waiting for the arbitrator, who can rule at any time; after ${iso(due)} anyone can close it by timeout. No need to check again before ${iso(next)}, ${WAIT_TIP}.`,
      };
    }
    default:
      return done(
        version === 3
          ? 'Final state: no need to check again. Any amount owed to you is credited in the escrow (get_withdrawable, prepare_withdraw).'
          : 'Final state: no need to check again.'
      );
  }
}
