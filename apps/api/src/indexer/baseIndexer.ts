import { createPublicClient, http, parseAbiItem } from 'viem';
import { baseSepolia } from 'viem/chains';
import { db, orders, blockchainTransactions } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { MarketplaceEscrowAbi } from '@mercadopleis/contracts-abi';
import { config } from '../config';

/**
 * Blockchain Event Indexer for MarketplaceEscrow on Base Sepolia
 */
export class BaseIndexer {
  private client: any;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastIndexedBlock: bigint = 0n;

  constructor() {
    this.client = createPublicClient({
      chain: baseSepolia,
      transport: http(config.rpcUrl),
    });
  }

  public async start() {
    if (this.isRunning) return;
    if (config.escrowAddress === '0x0000000000000000000000000000000000000000') {
      console.log('[Indexer] Escrow contract address not configured yet. Indexer in standby.');
      return;
    }

    this.isRunning = true;
    console.log(`[Indexer] Starting Base Sepolia indexer for escrow: ${config.escrowAddress}`);

    try {
      this.lastIndexedBlock = await this.client.getBlockNumber();
    } catch (e) {
      console.warn('[Indexer] Could not fetch current block number, defaulting to 0');
    }

    // Poll every 10 seconds for new events
    this.pollInterval = setInterval(() => this.pollEvents(), 10_000);
  }

  public stop() {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async pollEvents() {
    try {
      const currentBlock = await this.client.getBlockNumber();
      if (currentBlock <= this.lastIndexedBlock) return;

      const fromBlock = this.lastIndexedBlock + 1n;
      const toBlock = currentBlock > fromBlock + 500n ? fromBlock + 500n : currentBlock;

      // Scan OrderFunded events
      const fundedLogs = await this.client.getContractEvents({
        address: config.escrowAddress,
        abi: MarketplaceEscrowAbi,
        eventName: 'OrderFunded',
        fromBlock,
        toBlock,
      });

      for (const log of fundedLogs) {
        const { orderId, buyer, seller, amount, deadline } = log.args as any;
        console.log(`[Indexer] OrderFunded detected: contractOrderId=${orderId}`);

        // Update database order matching buyer and seller or contractOrderId
        await db
          .update(orders)
          .set({
            contractOrderId: Number(orderId),
            status: 'FUNDED',
            txHashFunding: log.transactionHash,
            updatedAt: new Date(),
          })
          .where(eq(orders.contractOrderId, Number(orderId)));

        // Record blockchain transaction
        await db.insert(blockchainTransactions).values({
          txHash: log.transactionHash,
          chainId: config.chainId,
          eventType: 'OrderFunded',
          blockNumber: Number(log.blockNumber),
          status: 'CONFIRMED',
        }).onConflictDoNothing();
      }

      // Scan DeliverySubmitted events
      const deliveryLogs = await this.client.getContractEvents({
        address: config.escrowAddress,
        abi: MarketplaceEscrowAbi,
        eventName: 'DeliverySubmitted',
        fromBlock,
        toBlock,
      });

      for (const log of deliveryLogs) {
        const { orderId, deliveryHash, autoReleaseTime } = log.args as any;
        console.log(`[Indexer] DeliverySubmitted detected: contractOrderId=${orderId}`);

        await db
          .update(orders)
          .set({
            status: 'DELIVERED',
            deliveryHash,
            autoReleaseDeadline: Number(autoReleaseTime),
            deliveredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.contractOrderId, Number(orderId)));
      }

      // Scan OrderReleased events
      const releaseLogs = await this.client.getContractEvents({
        address: config.escrowAddress,
        abi: MarketplaceEscrowAbi,
        eventName: 'OrderReleased',
        fromBlock,
        toBlock,
      });

      for (const log of releaseLogs) {
        const { orderId } = log.args as any;
        console.log(`[Indexer] OrderReleased detected: contractOrderId=${orderId}`);

        await db
          .update(orders)
          .set({
            status: 'RELEASED',
            releasedAt: new Date(),
            txHashRelease: log.transactionHash,
            updatedAt: new Date(),
          })
          .where(eq(orders.contractOrderId, Number(orderId)));
      }

      this.lastIndexedBlock = toBlock;
    } catch (error) {
      console.error('[Indexer] Error indexing events:', error);
    }
  }
}

export const baseIndexer = new BaseIndexer();
