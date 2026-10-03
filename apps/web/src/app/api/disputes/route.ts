import { NextRequest, NextResponse } from 'next/server';
import { db, disputes, orders } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { LIMITS, isSafeHttpUrl } from '@/lib/validation';
import { createPublicClient, http, parseEventLogs } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';

export const dynamic = 'force-dynamic';

async function verifyOnChainDisputeOpen(
  txHash: `0x${string}`,
  contractOrderId: number,
  expectedInitiatorWallet: string,
  targetChainId: number
): Promise<boolean> {
  const isSepolia = targetChainId === 84532;
  const chain = isSepolia ? baseSepolia : base;
  const escrow = ESCROW_ADDRESSES[isSepolia ? 84532 : 8453];
  const rpc = isSepolia
    ? (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org')
    : (process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org');

  try {
    const client = createPublicClient({ chain, transport: http(rpc) });
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt && receipt.status === 'success') {
      if (!receipt.to || receipt.to.toLowerCase() !== escrow.toLowerCase()) {
        return false;
      }

      const logs = parseEventLogs({
        abi: MarketplaceEscrowAbi,
        logs: receipt.logs,
        eventName: 'DisputeOpened',
      });

      if (logs.length > 0) {
        const log = logs[0];
        if (
          log.address.toLowerCase() === escrow.toLowerCase() &&
          Number(log.args.orderId) === contractOrderId &&
          log.args.openedBy.toLowerCase() === expectedInitiatorWallet.toLowerCase()
        ) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Strictly restricted to ADMINISTRATOR only
  if (authUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const list = await db.query.disputes.findMany({
      orderBy: [desc(disputes.createdAt)],
      with: {
        order: {
          with: {
            service: true,
            buyer: {
              columns: {
                id: true,
                walletAddress: true,
                displayName: true,
              },
            },
            seller: {
              columns: {
                id: true,
                walletAddress: true,
                displayName: true,
              },
            },
          },
        },
        openedBy: {
          columns: {
            id: true,
            walletAddress: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json({ disputes: list });
  } catch (error: any) {
    console.error('Error fetching disputes:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orderId, reason, evidenceUrl, txHash, txHashDispute } = body;

    if (!orderId || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: 'orderId and reason are required' }, { status: 400 });
    }
    if (reason.length > LIMITS.reasonMax) {
      return NextResponse.json({ error: `reason must be at most ${LIMITS.reasonMax} characters` }, { status: 400 });
    }
    if (evidenceUrl && !isSafeHttpUrl(evidenceUrl)) {
      return NextResponse.json({ error: 'evidenceUrl must be an http(s) URL' }, { status: 400 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        buyer: true,
        seller: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyerId !== authUser.id && order.sellerId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only participants can open a dispute' }, { status: 403 });
    }

    if (!order.contractOrderId) {
      return NextResponse.json({ error: 'Order has no contractOrderId on-chain' }, { status: 400 });
    }

    const disputeTx = txHashDispute ?? txHash;
    if (!disputeTx || typeof disputeTx !== 'string' || !disputeTx.startsWith('0x') || disputeTx.length !== 66) {
      return NextResponse.json(
        { error: 'Valid on-chain transaction hash for openDispute() is required' },
        { status: 400 }
      );
    }

    const targetChainId = order.chainId || 8453;
    const isValidOnChain = await verifyOnChainDisputeOpen(
      disputeTx as `0x${string}`,
      order.contractOrderId,
      authUser.walletAddress,
      targetChainId
    );

    if (!isValidOnChain) {
      return NextResponse.json(
        { error: `Transaction verification failed: DisputeOpened event not confirmed on chain ${targetChainId} for this order` },
        { status: 400 }
      );
    }

    const existingDispute = await db.query.disputes.findFirst({
      where: eq(disputes.orderId, orderId),
    });

    if (existingDispute) {
      return NextResponse.json({ error: 'A dispute already exists for this order' }, { status: 400 });
    }

    const [newDispute] = await db
      .insert(disputes)
      .values({
        orderId,
        openedById: authUser.id,
        reason,
        evidenceUrl: evidenceUrl || null,
        status: 'OPEN',
      })
      .returning();

    await db
      .update(orders)
      .set({ status: 'DISPUTED', updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    return NextResponse.json({ dispute: newDispute }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating dispute:', error);
    return NextResponse.json({ error: 'Failed to open dispute', details: error?.message }, { status: 500 });
  }
}
