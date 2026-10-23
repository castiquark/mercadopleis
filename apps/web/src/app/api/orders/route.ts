import { NextRequest, NextResponse } from 'next/server';
import { db, orders, services } from '@mercadopleis/database';
import { and, eq } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { notifyOrder } from '@/lib/notify';
import { calculateOrderAmounts, MarketplaceEscrowV3Abi as MarketplaceEscrowAbi } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { createPublicClient, http, parseEventLogs, parseUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { enforceRateLimit } from '@/lib/rateLimit';
import { currentEscrowKey, knownEscrows } from '@/lib/networks';
import { readEscrowOrder } from '@/lib/escrowState';

interface VerifiedFunding {
  isValid: boolean;
  chainId: number;
  orderId: number;
  buyer: string;
  seller: string;
  token: string;
  amount: bigint;
  deadline: number;
  /** Lowercase address of the escrow that emitted OrderFunded. */
  escrowAddress?: string;
  error?: string;
}

async function verifyOnChainFunding(
  txHash: `0x${string}`,
  requestedChainId?: number
): Promise<VerifiedFunding> {
  const targetChainId = requestedChainId === 84532 ? 84532 : 8453;
  const isSepolia = targetChainId === 84532;
  const chain = isSepolia ? baseSepolia : base;
  const escrows = knownEscrows(targetChainId).map((a) => a.toLowerCase());
  const rpc = isSepolia
    ? (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org')
    : (process.env.BASE_MAINNET_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org');

  try {
    const client = createPublicClient({ chain, transport: http(rpc) });
    // The wallet may already see the receipt while this RPC has not indexed it yet, so wait briefly for it.
    const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 8_000, pollingInterval: 1_000 });

    if (receipt && receipt.status === 'success') {
      // The OrderFunded event emitted by the escrow is the proof. The transaction itself may be sent to another
      // contract: smart accounts (EIP-7702, ERC-4337), relayers and batched calls reach the escrow indirectly,
      // and the escrow still records the user's wallet as the buyer.
      const logs = parseEventLogs({
        abi: MarketplaceEscrowAbi,
        logs: receipt.logs,
        eventName: 'OrderFunded',
      });
      const log = logs.find((l) => escrows.includes(l.address.toLowerCase()));

      if (log) {
        return {
          isValid: true,
          chainId: chain.id,
          orderId: Number(log.args.orderId),
          buyer: log.args.buyer,
          seller: log.args.seller,
          token: log.args.token,
          amount: log.args.amount,
          deadline: Number(log.args.deadline),
          escrowAddress: log.address.toLowerCase(),
        };
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
    let verification = await verifyOnChainFunding(txHashFunding as `0x${string}`, targetChainId);
    if (!verification.isValid && Number.isInteger(Number(contractOrderId))) {
      // No receipt for that hash (smart account or relayer): read the order from the contract instead. The checks
      // below (buyer, seller, amount) apply to it exactly as to the OrderFunded event.
      const onChain = await readEscrowOrder(targetChainId, Number(contractOrderId));
      if (onChain) {
        verification = {
          isValid: true,
          chainId: targetChainId,
          orderId: Number(contractOrderId),
          buyer: onChain.buyer,
          seller: onChain.seller,
          token: onChain.token,
          amount: onChain.amount,
          deadline: onChain.deadline,
        };
      }
    }
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
      where: and(
        eq(orders.contractOrderId, verification.orderId),
        eq(orders.chainId, verification.chainId),
        eq(orders.escrowAddress, verification.escrowAddress ?? currentEscrowKey(verification.chainId))
      ),
    });

    if (existingOrder) {
      // The stored row belongs to another buyer: it is not this order (stale or foreign data). Hashes alone are not
      // compared, since smart accounts and relayers can land the same funding under a different transaction hash.
      if (existingOrder.buyerId !== authUser.id) {
        return NextResponse.json(
          { error: 'An order with this escrow id is already registered for a different buyer' },
          { status: 409 }
        );
      }
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
      CONTRACT_CONFIG.FEE_BPS
    );

    const [newOrder] = await db
      .insert(orders)
      .values({
        serviceId: service.id,
        buyerId: authUser.id,
        sellerId: service.sellerId,
        contractOrderId: verification.orderId,
        chainId: verification.chainId,
        escrowAddress: verification.escrowAddress ?? currentEscrowKey(verification.chainId),
        txHashFunding,
        grossAmountUsdc: grossAmount.toString(),
        platformFeeBps: feeBps,
        platformFeeUsdc: platformFeeUsdc.toString(),
        sellerAmountUsdc: sellerAmountUsdc.toString(),
        status: 'FUNDED',
        deadlineTimestamp: verification.deadline,
      })
      .returning();

    await notifyOrder(newOrder, 'order_funded', ['seller']);

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
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
