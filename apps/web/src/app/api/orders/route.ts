import { NextRequest, NextResponse } from 'next/server';
import { db, orders, services, users } from '@mercadopleis/database';
import { and, eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { calculateOrderAmounts, MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { createPublicClient, http, parseEventLogs, parseUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { enforceRateLimit } from '@/lib/rateLimit';

interface VerifiedFunding {
  isValid: boolean;
  chainId: number;
  orderId: number;
  buyer: string;
  seller: string;
  token: string;
  amount: bigint;
  deadline: number;
  error?: string;
}

async function verifyOnChainFunding(
  txHash: `0x${string}`,
  requestedChainId?: number
): Promise<VerifiedFunding> {
  const targetChainId = requestedChainId === 84532 ? 84532 : 8453;
  const isSepolia = targetChainId === 84532;
  const chain = isSepolia ? baseSepolia : base;
  const escrow = ESCROW_ADDRESSES[targetChainId];
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
          chainId: targetChainId,
          orderId: 0,
          buyer: '',
          seller: '',
          token: '',
          amount: 0n,
          deadline: 0,
          error: `Transaction was not sent to valid escrow contract (${escrow}) on chain ${targetChainId}`,
        };
      }

      const logs = parseEventLogs({
        abi: MarketplaceEscrowAbi,
        logs: receipt.logs,
        eventName: 'OrderFunded',
      });

      if (logs.length > 0) {
        const log = logs[0];
        if (log.address.toLowerCase() === escrow.toLowerCase()) {
          return {
            isValid: true,
            chainId: chain.id,
            orderId: Number(log.args.orderId),
            buyer: log.args.buyer,
            seller: log.args.seller,
            token: log.args.token,
            amount: log.args.amount,
            deadline: Number(log.args.deadline),
          };
        }
      }
    }
  } catch (err: any) {
    return {
      isValid: false,
      chainId: targetChainId,
      orderId: 0,
      buyer: '',
      seller: '',
      token: '',
      amount: 0n,
      deadline: 0,
      error: `Could not verify transaction receipt on chain ${targetChainId}: ${err?.message}`,
    };
  }

  return {
    isValid: false,
    chainId: targetChainId,
    orderId: 0,
    buyer: '',
    seller: '',
    token: '',
    amount: 0n,
    deadline: 0,
    error: `Funding transaction or OrderFunded event not confirmed on chain ${targetChainId}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Wallet authentication via SIWE is required to register escrow orders' },
        { status: 401 }
      );
    }

    const limited = await enforceRateLimit([{ name: 'orders:register', id: authUser.id, limit: 20, windowSeconds: 3600 }]);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const { serviceId, contractOrderId, txHashFunding, chainId } = body;

    if (!serviceId || !txHashFunding || contractOrderId === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters: serviceId, contractOrderId, and txHashFunding are mandatory' },
        { status: 400 }
      );
    }

    if (typeof txHashFunding !== 'string' || !txHashFunding.startsWith('0x') || txHashFunding.length !== 66) {
      return NextResponse.json({ error: 'Invalid txHashFunding transaction hash format' }, { status: 400 });
    }

    // Verify service exists
    const service = await db.query.services.findFirst({
      where: eq(services.id, serviceId),
      with: {
        seller: true,
      },
    });

    if (!service || !service.isActive) {
      return NextResponse.json({ error: 'Service is not active or unavailable' }, { status: 404 });
    }

    if (!service.seller?.walletAddress) {
      return NextResponse.json({ error: 'Service seller has no associated wallet address' }, { status: 500 });
    }

    const targetChainId = Number(chainId) === 84532 ? 84532 : 8453;

    // Verify on-chain funding event strictly on targetChainId
    const verification = await verifyOnChainFunding(txHashFunding as `0x${string}`, targetChainId);
    if (!verification.isValid) {
      return NextResponse.json({ error: verification.error || 'On-chain funding verification failed' }, { status: 400 });
    }

    if (verification.orderId !== Number(contractOrderId)) {
      return NextResponse.json(
        { error: `On-chain orderId (${verification.orderId}) does not match supplied contractOrderId (${contractOrderId})` },
        { status: 400 }
      );
    }

    if (verification.buyer.toLowerCase() !== authUser.walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'On-chain depositor (buyer) does not match authenticated user wallet' },
        { status: 403 }
      );
    }

    if (verification.seller.toLowerCase() !== service.seller.walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'On-chain recipient (seller) does not match service provider wallet' },
        { status: 400 }
      );
    }

    const expectedAmountRaw = parseUnits(service.priceUsdc, 6);
    if (verification.amount !== expectedAmountRaw) {
      return NextResponse.json(
        { error: `On-chain deposited amount does not match listed service price` },
        { status: 400 }
      );
    }

    // Check if this contractOrderId is already registered in DB
    const existingOrder = await db.query.orders.findFirst({
      where: and(eq(orders.contractOrderId, verification.orderId), eq(orders.chainId, verification.chainId)),
    });

    if (existingOrder) {
      if (existingOrder.serviceId !== service.id) {
        await db
          .update(orders)
          .set({ serviceId: service.id, updatedAt: new Date() })
          .where(eq(orders.id, existingOrder.id));
        existingOrder.serviceId = service.id;
      }
      return NextResponse.json(
        { message: 'Order already registered and synchronized in system', order: existingOrder },
        { status: 200 }
      );
    }

    const grossAmount = parseFloat(service.priceUsdc);
    const { platformFeeUsdc, sellerAmountUsdc, feeBps } = calculateOrderAmounts(
      grossAmount,
      CONTRACT_CONFIG.INITIAL_FEE_BPS
    );

    const [newOrder] = await db
      .insert(orders)
      .values({
        serviceId: service.id,
        buyerId: authUser.id,
        sellerId: service.sellerId,
        contractOrderId: verification.orderId,
        chainId: verification.chainId,
        txHashFunding,
        grossAmountUsdc: grossAmount.toString(),
        platformFeeBps: feeBps,
        platformFeeUsdc: platformFeeUsdc.toString(),
        sellerAmountUsdc: sellerAmountUsdc.toString(),
        status: 'FUNDED',
        deadlineTimestamp: verification.deadline,
      })
      .returning();

    return NextResponse.json(
      {
        order: newOrder,
        verifiedOnChain: {
          chainId: verification.chainId,
          contractOrderId: verification.orderId,
          grossAmount,
          platformFeeUsdc,
          sellerAmountUsdc,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error creating order:', err);
    return NextResponse.json({ error: 'Failed to create order', details: err?.message }, { status: 500 });
  }
}
