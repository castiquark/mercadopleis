import { NextRequest, NextResponse } from 'next/server';
import { db, disputes, orders } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { createPublicClient, http, parseEventLogs, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';

export const dynamic = 'force-dynamic';

async function verifyOnChainDisputeResolution(
  txHash: `0x${string}`,
  contractOrderId: number,
  targetChainId: number
): Promise<{
  isValid: boolean;
  sellerPayoutUsdc: string;
  buyerRefundUsdc: string;
  platformFeeUsdc: string;
  error?: string;
}> {
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
        return {
          isValid: false,
          sellerPayoutUsdc: '0',
          buyerRefundUsdc: '0',
          platformFeeUsdc: '0',
          error: `Transaction was not sent to valid escrow contract on chain ${targetChainId}`,
        };
      }

      const logs = parseEventLogs({
        abi: MarketplaceEscrowAbi,
        logs: receipt.logs,
        eventName: 'DisputeResolved',
      });

      if (logs.length > 0) {
        const log = logs[0];
        if (
          log.address.toLowerCase() === escrow.toLowerCase() &&
          Number(log.args.orderId) === contractOrderId
        ) {
          return {
            isValid: true,
            sellerPayoutUsdc: formatUnits(log.args.sellerPayout, 6),
            buyerRefundUsdc: formatUnits(log.args.buyerRefund, 6),
            platformFeeUsdc: formatUnits(log.args.platformFee, 6),
          };
        }
      }
    }
  } catch {
    // Error querying RPC
  }

  return {
    isValid: false,
    sellerPayoutUsdc: '0',
    buyerRefundUsdc: '0',
    platformFeeUsdc: '0',
    error: `DisputeResolved event not found or transaction not confirmed on chain ${targetChainId}`,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  if (authUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Only authorized administrators or arbitrators can resolve disputes' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { txHash, txHashResolution, resolutionNotes } = body;

    const resolutionTx = txHashResolution ?? txHash;
    if (!resolutionTx || typeof resolutionTx !== 'string' || !resolutionTx.startsWith('0x') || resolutionTx.length !== 66) {
      return NextResponse.json(
        { error: 'Valid on-chain transaction hash for resolveDispute() is mandatory' },
        { status: 400 }
      );
    }

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.id, id),
      with: { order: true },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (dispute.status === 'RESOLVED') {
      return NextResponse.json({ error: 'Dispute is already resolved' }, { status: 400 });
    }

    if (!dispute.order?.contractOrderId) {
      return NextResponse.json({ error: 'Associated order has no contractOrderId on-chain' }, { status: 400 });
    }

    // Verify on-chain execution of MarketplaceEscrow.resolveDispute()
    const targetChainId = dispute.order.chainId || 8453;
    const verification = await verifyOnChainDisputeResolution(
      resolutionTx as `0x${string}`,
      dispute.order.contractOrderId,
      targetChainId
    );

    if (!verification.isValid) {
      return NextResponse.json(
        { error: verification.error || 'On-chain verification of DisputeResolved failed' },
        { status: 400 }
      );
    }

    const [updatedDispute] = await db
      .update(disputes)
      .set({
        status: 'RESOLVED',
        arbitratorId: authUser.id,
        sellerAwardUsdc: verification.sellerPayoutUsdc,
        buyerRefundUsdc: verification.buyerRefundUsdc,
        resolutionNotes: resolutionNotes || 'Resolved on-chain via smart contract',
        resolvedAt: new Date(),
      })
      .where(eq(disputes.id, id))
      .returning();

    const sellerPayoutNum = parseFloat(verification.sellerPayoutUsdc);
    const buyerRefundNum = parseFloat(verification.buyerRefundUsdc);

    let finalOrderStatus: string = 'RESOLVED';
    if (sellerPayoutNum > 0 && buyerRefundNum === 0) {
      finalOrderStatus = 'RELEASED';
    } else if (buyerRefundNum > 0 && sellerPayoutNum === 0) {
      finalOrderStatus = 'REFUNDED';
    }

    await db
      .update(orders)
      .set({
        status: finalOrderStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, dispute.orderId));

    return NextResponse.json({
      dispute: updatedDispute,
      verifiedOnChain: {
        sellerPayoutUsdc: verification.sellerPayoutUsdc,
        buyerRefundUsdc: verification.buyerRefundUsdc,
        platformFeeUsdc: verification.platformFeeUsdc,
        finalOrderStatus,
      },
      message: 'Dispute resolved and verified on-chain successfully',
    });
  } catch (error: any) {
    console.error('Error resolving dispute:', error);
    return NextResponse.json({ error: 'Failed to resolve dispute' }, { status: 500 });
  }
}
