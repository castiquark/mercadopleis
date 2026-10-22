import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseEventLogs, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { db, orders, disputes, blockchainTransactions, users, services } from '@mercadopleis/database';
import { notifyOrder, counterpart } from '@/lib/notify';
import { and, eq, desc } from 'drizzle-orm';
import {
  ESCROW_ADDRESSES,
  ESCROW_DEPLOY_BLOCKS,
  ESCROW_V3_ADDRESSES,
  ESCROW_V3_DEPLOY_BLOCKS,
  MarketplaceEscrowAbi,
  MarketplaceEscrowV3Abi,
} from '@mercadopleis/contracts-abi';

// Public RPCs reject large getLogs ranges, so scan in small windows and catch up over several calls.
// Each provider caps eth_getLogs differently (public Base: 1,000 blocks; public Base Sepolia: 200), so the window
// can be raised with SYNC_LOG_CHUNK_BLOCKS when a dedicated RPC allows more.
const DEFAULT_CHUNK_BLOCKS = { mainnet: 1_000n, sepolia: 200n };
const MAX_CHUNKS_PER_RUN = 30n; // call again to continue
import { CONTRACT_CONFIG } from '@mercadopleis/types';

export const dynamic = 'force-dynamic';

async function ensureUserForWallet(walletAddress: string) {
  const normalized = walletAddress.toLowerCase();
  const existing = await db.query.users.findFirst({
    where: eq(users.walletAddress, normalized),
  });
  if (existing) return existing;

  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  const randomSuffix = Math.floor(Math.random() * 10000);
  const [created] = await db
    .insert(users)
    .values({
      walletAddress: normalized,
      username: `user_${walletAddress.slice(2, 8)}_${randomSuffix}`,
      displayName: shortAddr,
      role: 'USER',
    })
    .returning();
  return created;
}

async function ensureServiceForSeller(sellerId: string, grossAmountUsdc: string, orderId: number) {
  const existing = await db.query.services.findFirst({
    where: eq(services.sellerId, sellerId),
  });
  if (existing) return existing;

  const randomSuffix = Math.floor(Math.random() * 10000);
  const [created] = await db
    .insert(services)
    .values({
      sellerId,
      title: `Servicio Escrow On-Chain (#${orderId})`,
      slug: `servicio-escrow-${orderId}-${randomSuffix}`,
      description: `Servicio autoconciliado desde evento on-chain de contrato Escrow (#${orderId}).`,
      category: 'desarrollo',
      priceUsdc: grossAmountUsdc,
      deliveryDays: 7,
      deliveryType: 'digital',
      // Placeholder for an order created outside the web (e.g. an agent calling the contract directly): it only
      // gives the order a service row and must never appear in the public catalog.
      isActive: false,
      isListed: false,
    })
    .returning();
  return created;
}

type EscrowVersion = 'v2' | 'v3';

// Each escrow keeps its own cursor: v2 in SYNC_CHECKPOINT rows (as before v3), v3 in SYNC_CHECKPOINT_V3 rows. The v2
// escrow stays indexed after v3 goes live, for the orders created on it before the switch.
const CHECKPOINT = {
  v2: { eventType: 'SYNC_CHECKPOINT', prefix: 'checkpoint' },
  v3: { eventType: 'SYNC_CHECKPOINT_V3', prefix: 'checkpoint3' },
};

async function syncEscrow(opts: {
  client: any;
  targetChainId: number;
  escrowAddress: `0x${string}`;
  deployBlock: number | undefined;
  version: EscrowVersion;
  chunkBlocks: bigint;
  currentBlock: bigint;
  requestedFrom: string | null;
}) {
  const { client, targetChainId, escrowAddress, deployBlock, version, chunkBlocks: CHUNK_BLOCKS, currentBlock, requestedFrom } = opts;
  const escrowKey = escrowAddress.toLowerCase();
  const checkpoint = CHECKPOINT[version];

  // 1. Persistent cursor: the latest checkpoint of this escrow. Every run writes one at the last scanned block, so it
  //    is never behind the events it covered. A v2 chain indexed before checkpoints existed falls back to its
  //    latest row, as before.
  const latestCheckpoint = await db.query.blockchainTransactions.findFirst({
    where: and(eq(blockchainTransactions.chainId, targetChainId), eq(blockchainTransactions.eventType, checkpoint.eventType)),
    orderBy: [desc(blockchainTransactions.blockNumber)],
  });
  const latestTx = latestCheckpoint ?? (version === 'v2'
    ? await db.query.blockchainTransactions.findFirst({
      where: eq(blockchainTransactions.chainId, targetChainId),
      orderBy: [desc(blockchainTransactions.blockNumber)],
    })
    : undefined);

  let fromBlock: bigint;
  if (latestTx && latestTx.blockNumber) {
    fromBlock = BigInt(latestTx.blockNumber) + 1n;
  } else if (deployBlock !== undefined) {
    fromBlock = BigInt(deployBlock);
  } else {
    fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;
  }
  // Rows from an older escrow deployment can leave the cursor before the current contract existed.
  if (deployBlock !== undefined && fromBlock < BigInt(deployBlock)) fromBlock = BigInt(deployBlock);

  // This endpoint is public: an explicit fromBlock may only rescan backwards (reconciliation is idempotent).
  // Moving the cursor forward would let anyone make the indexer skip events.
  if (requestedFrom && /^\d+$/.test(requestedFrom)) {
    const requested = BigInt(requestedFrom);
    if (requested < fromBlock && (deployBlock === undefined || requested >= BigInt(deployBlock))) fromBlock = requested;
  }

  if (fromBlock > currentBlock) {
    return { version, escrowAddress, upToDate: true, lastIndexedBlock: latestTx?.blockNumber };
  }

  // 2. Scan the escrow lifecycle events in bounded windows. RPC providers reject large getLogs ranges, and a
  //    single failing range would otherwise block the indexer forever. Each call catches up by at most
  //    MAX_CHUNKS_PER_RUN windows and the checkpoint only advances to what was actually scanned.
  const scanTo = (() => {
    const cap = fromBlock + CHUNK_BLOCKS * MAX_CHUNKS_PER_RUN - 1n;
    return currentBlock < cap ? currentBlock : cap;
  })();

  const rawLogs: any[] = [];
  for (let start = fromBlock; start <= scanTo; start += CHUNK_BLOCKS) {
    const end = start + CHUNK_BLOCKS - 1n < scanTo ? start + CHUNK_BLOCKS - 1n : scanTo;
    rawLogs.push(...(await client.getLogs({ address: escrowAddress, fromBlock: start, toBlock: end })));
  }

  const abi = version === 'v3' ? MarketplaceEscrowV3Abi : MarketplaceEscrowAbi;
  const decoded = parseEventLogs({ abi, logs: rawLogs, strict: false }) as any[];
  const byEvent = (name: string) => decoded.filter((l) => l.eventName === name);
  const orderFundedLogs = byEvent('OrderFunded');
  const deliveryLogs = byEvent('DeliverySubmitted');
  const releaseLogs = byEvent('OrderReleased');
  const refundLogs = byEvent('OrderRefunded');
  const disputeOpenedLogs = byEvent('DisputeOpened');
  const disputeResolvedLogs = byEvent('DisputeResolved');
  // v3 pull payments: balances are read on-chain (withdrawable), so these are only counted.
  const creditedLogs = byEvent('Credited');
  const withdrawnLogs = byEvent('Withdrawn');

  // 3. Reconcile Events with Database

    // Reconcile OrderFunded
    for (const log of orderFundedLogs) {
      const orderId = Number((log.args as any).orderId);
      const buyerAddr = String((log.args as any).buyer || '').toLowerCase();
      const sellerAddr = String((log.args as any).seller || '').toLowerCase();
      const rawAmount = (log.args as any).amount;
      const deadline = Number((log.args as any).deadline);

      let existing = await db.query.orders.findFirst({
        where: and(eq(orders.contractOrderId, orderId), eq(orders.chainId, targetChainId), eq(orders.escrowAddress, escrowKey)),
      });

      if (!existing && buyerAddr && sellerAddr) {
        // Orphaned OrderFunded event: indexer processed block before frontend registration
        try {
          const buyerUser = await ensureUserForWallet(buyerAddr);
          const sellerUser = await ensureUserForWallet(sellerAddr);
          const grossAmountNum = Number(rawAmount) / 1e6;
          const grossAmountStr = grossAmountNum.toFixed(2);
          const platformFeeNum = (grossAmountNum * 300) / 10000;
          const sellerAmountNum = grossAmountNum - platformFeeNum;

          const candidateService = await ensureServiceForSeller(sellerUser.id, grossAmountStr, orderId);

          const [createdOrder] = await db
            .insert(orders)
            .values({
              contractOrderId: orderId,
              serviceId: candidateService.id,
              buyerId: buyerUser.id,
              sellerId: sellerUser.id,
              chainId: targetChainId,
              escrowAddress: escrowKey,
              grossAmountUsdc: grossAmountStr,
              platformFeeBps: CONTRACT_CONFIG.FEE_BPS,
              platformFeeUsdc: platformFeeNum.toFixed(2),
              sellerAmountUsdc: sellerAmountNum.toFixed(2),
              status: 'FUNDED',
              deadlineTimestamp: deadline || (Math.floor(Date.now() / 1000) + 7 * 86400),
              txHashFunding: log.transactionHash,
            })
            .returning();

          existing = createdOrder;
          await notifyOrder(createdOrder, 'order_funded', ['seller']);
        } catch (orphanErr) {
          console.error(`Failed to reconcile orphaned OrderFunded #${orderId}:`, orphanErr);
        }
      } else if (existing) {
        if (existing.status === 'CREATED') {
          await db
            .update(orders)
            .set({ status: 'FUNDED', txHashFunding: log.transactionHash, updatedAt: new Date() })
            .where(eq(orders.id, existing.id));
          await notifyOrder(existing, 'order_funded', ['seller']);
        }
      }

      if (existing) {
        await db.insert(blockchainTransactions).values({
          orderId: existing.id,
          txHash: log.transactionHash,
          chainId: targetChainId,
          eventType: 'OrderFunded',
          blockNumber: Number(log.blockNumber),
          status: 'CONFIRMED',
        }).onConflictDoNothing();
      }
    }

    // Reconcile DeliverySubmitted
    for (const log of deliveryLogs) {
      const orderId = Number((log.args as any).orderId);
      const deliveryHash = (log.args as any).deliveryHash;
      const autoReleaseDeadline = Number((log.args as any).autoReleaseTime);
      const existing = await db.query.orders.findFirst({
        where: and(eq(orders.contractOrderId, orderId), eq(orders.chainId, targetChainId), eq(orders.escrowAddress, escrowKey)),
      });
      if (existing) {
        // v3 emits autoReleaseTime 0 for a delivery submitted during a dispute: the order stays DISPUTED.
        const inDispute = autoReleaseDeadline === 0;
        await db
          .update(orders)
          .set(inDispute
            ? { deliveryHash, deliveredAt: new Date(), updatedAt: new Date() }
            : { status: 'DELIVERED', deliveryHash, autoReleaseDeadline, deliveredAt: new Date(), updatedAt: new Date() })
          .where(eq(orders.id, existing.id));
        // Notify only on a real transition: re-scans of old blocks must not announce past events.
        if (existing.status === 'FUNDED') await notifyOrder(existing, 'order_delivered', ['buyer']);

        await db.insert(blockchainTransactions).values({
          orderId: existing.id,
          txHash: log.transactionHash,
          chainId: targetChainId,
          eventType: 'DeliverySubmitted',
          blockNumber: Number(log.blockNumber),
          status: 'CONFIRMED',
        }).onConflictDoNothing();
      }
    }

    // Reconcile OrderReleased
    for (const log of releaseLogs) {
      const orderId = Number((log.args as any).orderId);
      const existing = await db.query.orders.findFirst({
        where: and(eq(orders.contractOrderId, orderId), eq(orders.chainId, targetChainId), eq(orders.escrowAddress, escrowKey)),
      });
      if (existing) {
        await db
          .update(orders)
          .set({ status: 'RELEASED', txHashRelease: log.transactionHash, releasedAt: new Date(), updatedAt: new Date() })
          .where(eq(orders.id, existing.id));
        if (existing.status === 'DELIVERED') await notifyOrder(existing, 'order_released', ['seller']);

        await db.insert(blockchainTransactions).values({
          orderId: existing.id,
          txHash: log.transactionHash,
          chainId: targetChainId,
          eventType: 'OrderReleased',
          blockNumber: Number(log.blockNumber),
          status: 'CONFIRMED',
        }).onConflictDoNothing();
      }
    }

    // Reconcile OrderRefunded
    for (const log of refundLogs) {
      const orderId = Number((log.args as any).orderId);
      const existing = await db.query.orders.findFirst({
        where: and(eq(orders.contractOrderId, orderId), eq(orders.chainId, targetChainId), eq(orders.escrowAddress, escrowKey)),
      });
      if (existing) {
        await db
          .update(orders)
          .set({ status: 'REFUNDED', updatedAt: new Date() })
          .where(eq(orders.id, existing.id));
        if (existing.status === 'FUNDED') await notifyOrder(existing, 'order_refunded', ['seller']);

        await db.insert(blockchainTransactions).values({
          orderId: existing.id,
          txHash: log.transactionHash,
          chainId: targetChainId,
          eventType: 'OrderRefunded',
          blockNumber: Number(log.blockNumber),
          status: 'CONFIRMED',
        }).onConflictDoNothing();
      }
    }

    // Reconcile DisputeOpened
    for (const log of disputeOpenedLogs) {
      const orderId = Number((log.args as any).orderId);
      const openedByWallet = ((log.args as any).openedBy as string).toLowerCase();

      const existing = await db.query.orders.findFirst({
        where: and(eq(orders.contractOrderId, orderId), eq(orders.chainId, targetChainId), eq(orders.escrowAddress, escrowKey)),
      });

      if (existing) {
        await db
          .update(orders)
          .set({ status: 'DISPUTED', updatedAt: new Date() })
          .where(eq(orders.id, existing.id));
        if (existing.status === 'FUNDED' || existing.status === 'DELIVERED') {
          const opener = await db.query.users.findFirst({ where: eq(users.walletAddress, openedByWallet), columns: { id: true } });
          await notifyOrder(existing, 'dispute_opened', [...(opener ? [counterpart(existing, opener.id)] : (['buyer', 'seller'] as const)), 'admins']);
        }

        // Check if dispute row exists
        const existingDispute = await db.query.disputes.findFirst({
          where: eq(disputes.orderId, existing.id),
        });

        if (!existingDispute) {
          let openerUser = await db.query.users.findFirst({
            where: eq(users.walletAddress, openedByWallet),
          });

          if (!openerUser) {
            openerUser = await db.query.users.findFirst({
              where: eq(users.id, existing.buyerId),
            });
          }

          if (openerUser) {
            await db.insert(disputes).values({
              orderId: existing.id,
              openedById: openerUser.id,
              reason: `Dispute opened on-chain via ${version === 'v3' ? 'MarketplaceEscrowV3' : 'MarketplaceEscrow'}.openDispute()`,
              status: 'OPEN',
            }).onConflictDoNothing();
          }
        }

        await db.insert(blockchainTransactions).values({
          orderId: existing.id,
          txHash: log.transactionHash,
          chainId: targetChainId,
          eventType: 'DisputeOpened',
          blockNumber: Number(log.blockNumber),
          status: 'CONFIRMED',
        }).onConflictDoNothing();
      }
    }

    // Reconcile DisputeResolved
    for (const log of disputeResolvedLogs) {
      const orderId = Number((log.args as any).orderId);
      const sellerPayout = (log.args as any).sellerPayout as bigint;
      const buyerRefund = (log.args as any).buyerRefund as bigint;

      const existing = await db.query.orders.findFirst({
        where: and(eq(orders.contractOrderId, orderId), eq(orders.chainId, targetChainId), eq(orders.escrowAddress, escrowKey)),
      });

      if (existing) {
        const sellerPayoutNum = parseFloat(formatUnits(sellerPayout, 6));
        const buyerRefundNum = parseFloat(formatUnits(buyerRefund, 6));

        let finalStatus = 'RESOLVED';
        if (sellerPayoutNum > 0 && buyerRefundNum === 0) {
          finalStatus = 'RELEASED';
        } else if (buyerRefundNum > 0 && sellerPayoutNum === 0) {
          finalStatus = 'REFUNDED';
        }

        await db
          .update(orders)
          .set({ status: finalStatus, updatedAt: new Date() })
          .where(eq(orders.id, existing.id));
        if (existing.status === 'DISPUTED') await notifyOrder(existing, 'dispute_resolved', ['buyer', 'seller']);

        await db
          .update(disputes)
          .set({
            status: 'RESOLVED',
            sellerAwardUsdc: formatUnits(sellerPayout, 6),
            buyerRefundUsdc: formatUnits(buyerRefund, 6),
            resolvedAt: new Date(),
          })
          .where(eq(disputes.orderId, existing.id));

        await db.insert(blockchainTransactions).values({
          orderId: existing.id,
          txHash: log.transactionHash,
          chainId: targetChainId,
          eventType: 'DisputeResolved',
          blockNumber: Number(log.blockNumber),
          status: 'CONFIRMED',
        }).onConflictDoNothing();
      }
    }

    // 4. Save Persistent Checkpoint Cursor
    await db.insert(blockchainTransactions).values({
      txHash: `${checkpoint.prefix}_${targetChainId}_${scanTo}`,
      chainId: targetChainId,
      eventType: checkpoint.eventType,
      blockNumber: Number(scanTo),
      status: 'CONFIRMED',
    }).onConflictDoNothing();

  return {
    version,
    escrowAddress,
    scannedFromBlock: fromBlock.toString(),
    scannedToBlock: scanTo.toString(),
    upToDate: scanTo >= currentBlock,
    eventsFound: {
      orderFunded: orderFundedLogs.length,
      deliverySubmitted: deliveryLogs.length,
      orderReleased: releaseLogs.length,
      orderRefunded: refundLogs.length,
      disputeOpened: disputeOpenedLogs.length,
      disputeResolved: disputeResolvedLogs.length,
      ...(version === 'v3' ? { credited: creditedLogs.length, withdrawn: withdrawnLogs.length } : {}),
    },
  };
}

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit([{ name: 'sync:ip', id: getClientIp(request), limit: 12, windowSeconds: 60 }]);
  if (limited) return limited;

  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedChainId = Number(searchParams.get('chainId')) ||
      (process.env.NEXT_PUBLIC_CHAIN_ID ? Number(process.env.NEXT_PUBLIC_CHAIN_ID) : CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID);

    const isSepolia = requestedChainId === CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
    const targetChain = isSepolia ? baseSepolia : base;
    const targetChainId = targetChain.id;

    const rpcUrl = isSepolia
      ? (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org')
      : (process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org');

    // Per-chain registry only: a single env var cannot be right for both networks.
    const chunkBlocks = process.env.SYNC_LOG_CHUNK_BLOCKS && Number(process.env.SYNC_LOG_CHUNK_BLOCKS) > 0
      ? BigInt(Math.floor(Number(process.env.SYNC_LOG_CHUNK_BLOCKS)))
      : isSepolia ? DEFAULT_CHUNK_BLOCKS.sepolia : DEFAULT_CHUNK_BLOCKS.mainnet;

    const client = createPublicClient({
      chain: targetChain,
      transport: http(rpcUrl),
    });

    const currentBlock = await client.getBlockNumber();

    // ?escrow=v2|v3 limits the run to one escrow; ?fromBlock applies only to a single-escrow run.
    const only = searchParams.get('escrow');
    const v3Address = ESCROW_V3_ADDRESSES[targetChainId];
    const targets: { version: EscrowVersion; address: `0x${string}`; deployBlock: number | undefined }[] = [];
    if (v3Address && only !== 'v2') targets.push({ version: 'v3', address: v3Address, deployBlock: ESCROW_V3_DEPLOY_BLOCKS[targetChainId] });
    if (only !== 'v3') targets.push({ version: 'v2', address: ESCROW_ADDRESSES[targetChainId], deployBlock: ESCROW_DEPLOY_BLOCKS[targetChainId] });
    const requestedFrom = targets.length === 1 ? searchParams.get('fromBlock') : null;

    const results = [];
    for (const t of targets) {
      results.push(await syncEscrow({
        client,
        targetChainId,
        escrowAddress: t.address,
        deployBlock: t.deployBlock,
        version: t.version,
        chunkBlocks,
        currentBlock,
        requestedFrom,
      }));
    }

    return NextResponse.json({
      synced: true,
      network: targetChain.name,
      chainId: targetChainId,
      currentBlock: currentBlock.toString(),
      // Fields of the first escrow (v3 once deployed) at the top level, as before, for existing callers.
      ...results[0],
      upToDate: results.every((r) => r.upToDate),
      escrows: results,
    });
  } catch (err: any) {
    console.error('[Sync] Error during blockchain event reconciliation:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
