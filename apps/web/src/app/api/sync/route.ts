import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { db, orders, disputes, blockchainTransactions, users, services } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';
import { ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
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
      isActive: true,
    })
    .returning();
  return created;
}

export async function GET(request: NextRequest) {
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

    const escrowAddress = (
      process.env.MARKETPLACE_ESCROW_ADDRESS ||
      ESCROW_ADDRESSES[targetChainId] ||
      '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48'
    ) as `0x${string}`;

    const client = createPublicClient({
      chain: targetChain,
      transport: http(rpcUrl),
    });

    const currentBlock = await client.getBlockNumber();

    // 1. Persistent Cursor Lookup from blockchainTransactions
    const latestTx = await db.query.blockchainTransactions.findFirst({
      where: eq(blockchainTransactions.chainId, targetChainId),
      orderBy: [desc(blockchainTransactions.blockNumber)],
    });

    let fromBlock: bigint;
    if (searchParams.get('fromBlock')) {
      fromBlock = BigInt(searchParams.get('fromBlock')!);
    } else if (latestTx && latestTx.blockNumber) {
      fromBlock = BigInt(latestTx.blockNumber) + 1n;
    } else {
      const blocksToScan = BigInt(searchParams.get('blocks') || '1000');
      fromBlock = currentBlock > blocksToScan ? currentBlock - blocksToScan : 0n;
    }

    if (fromBlock > currentBlock) {
      return NextResponse.json({
        synced: true,
        message: 'Indexer is already up to date with latest block',
        chainId: targetChainId,
        currentBlock: currentBlock.toString(),
        lastIndexedBlock: latestTx?.blockNumber,
      });
    }

    // 2. Scan All 6 Escrow Lifecycle Events
    // Event 1: OrderFunded
    const orderFundedLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event OrderFunded(uint256 indexed orderId, address indexed buyer, address indexed seller, address token, uint256 amount, uint256 deadline)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Event 2: DeliverySubmitted
    const deliveryLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event DeliverySubmitted(uint256 indexed orderId, address indexed seller, bytes32 deliveryHash, uint256 autoReleaseTime)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Event 3: OrderReleased
    const releaseLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event OrderReleased(uint256 indexed orderId, uint256 sellerPayout, uint256 platformFee)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Event 4: OrderRefunded
    const refundLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 refundAmount)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Event 5: DisputeOpened
    const disputeOpenedLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event DisputeOpened(uint256 indexed orderId, address indexed openedBy)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // Event 6: DisputeResolved
    const disputeResolvedLogs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem('event DisputeResolved(uint256 indexed orderId, uint256 sellerPayout, uint256 buyerRefund, uint256 platformFee)'),
      fromBlock,
      toBlock: currentBlock,
    });

    // 3. Reconcile Events with Database

    // Reconcile OrderFunded
    for (const log of orderFundedLogs) {
      const orderId = Number((log.args as any).orderId);
      const buyerAddr = String((log.args as any).buyer || '').toLowerCase();
      const sellerAddr = String((log.args as any).seller || '').toLowerCase();
      const rawAmount = (log.args as any).amount;
      const deadline = Number((log.args as any).deadline);

      let existing = await db.query.orders.findFirst({
        where: eq(orders.contractOrderId, orderId),
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
              grossAmountUsdc: grossAmountStr,
              platformFeeBps: 300,
              platformFeeUsdc: platformFeeNum.toFixed(2),
              sellerAmountUsdc: sellerAmountNum.toFixed(2),
              status: 'FUNDED',
              deadlineTimestamp: deadline || (Math.floor(Date.now() / 1000) + 7 * 86400),
              txHashFunding: log.transactionHash,
            })
            .returning();

          existing = createdOrder;
        } catch (orphanErr) {
          console.error(`Failed to reconcile orphaned OrderFunded #${orderId}:`, orphanErr);
        }
      } else if (existing) {
        if (existing.status === 'CREATED') {
          await db
            .update(orders)
            .set({ status: 'FUNDED', txHashFunding: log.transactionHash, updatedAt: new Date() })
            .where(eq(orders.id, existing.id));
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
        where: eq(orders.contractOrderId, orderId),
      });
      if (existing) {
        await db
          .update(orders)
          .set({ status: 'DELIVERED', deliveryHash, autoReleaseDeadline, deliveredAt: new Date(), updatedAt: new Date() })
          .where(eq(orders.id, existing.id));

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
        where: eq(orders.contractOrderId, orderId),
      });
      if (existing) {
        await db
          .update(orders)
          .set({ status: 'RELEASED', txHashRelease: log.transactionHash, releasedAt: new Date(), updatedAt: new Date() })
          .where(eq(orders.id, existing.id));

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
        where: eq(orders.contractOrderId, orderId),
      });
      if (existing) {
        await db
          .update(orders)
          .set({ status: 'REFUNDED', updatedAt: new Date() })
          .where(eq(orders.id, existing.id));

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
        where: eq(orders.contractOrderId, orderId),
      });

      if (existing) {
        await db
          .update(orders)
          .set({ status: 'DISPUTED', updatedAt: new Date() })
          .where(eq(orders.id, existing.id));

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
              reason: 'Dispute opened on-chain via MarketplaceEscrow.openDispute()',
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
        where: eq(orders.contractOrderId, orderId),
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
      txHash: `checkpoint_${targetChainId}_${currentBlock}`,
      chainId: targetChainId,
      eventType: 'SYNC_CHECKPOINT',
      blockNumber: Number(currentBlock),
      status: 'CONFIRMED',
    }).onConflictDoNothing();

    return NextResponse.json({
      synced: true,
      network: targetChain.name,
      chainId: targetChainId,
      escrowAddress,
      scannedFromBlock: fromBlock.toString(),
      currentBlock: currentBlock.toString(),
      eventsFound: {
        orderFunded: orderFundedLogs.length,
        deliverySubmitted: deliveryLogs.length,
        orderReleased: releaseLogs.length,
        orderRefunded: refundLogs.length,
        disputeOpened: disputeOpenedLogs.length,
        disputeResolved: disputeResolvedLogs.length,
      },
    });
  } catch (err: any) {
    console.error('[Sync] Error during blockchain event reconciliation:', err);
    return NextResponse.json({ error: 'Sync failed', details: err?.message }, { status: 500 });
  }
}
