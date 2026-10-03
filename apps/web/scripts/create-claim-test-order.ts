/**
 * Creates a delivered order on Base Sepolia to test the seller "Claim payment" flow (claimAutoRelease)
 * after the 5-day review window.
 *
 *   pnpm --filter @mercadopleis/web exec tsx scripts/create-claim-test-order.ts          # dry run: balances only
 *   pnpm --filter @mercadopleis/web exec tsx scripts/create-claim-test-order.ts --send   # create, fund and deliver
 *
 * Seller = the deployer wallet (so it can claim from the web UI with the same wallet); buyer = a throwaway key.
 * Testnet only: the amount is 1 test USDC.
 */
import dotenv from 'dotenv';
import path from 'path';
import { createHash } from 'crypto';
import { createPublicClient, createWalletClient, http, parseEther, parseEventLogs, parseUnits, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { ESCROW_ADDRESSES, MarketplaceEscrowAbi, Erc20Abi } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SEND = process.argv.includes('--send');
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
if (!DEPLOYER_KEY) throw new Error('DEPLOYER_PRIVATE_KEY missing in apps/web/.env.local');

const rpc = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const escrow = ESCROW_ADDRESSES[84532] as `0x${string}`;
const usdc = CONTRACT_CONFIG.USDC_BASE_SEPOLIA as `0x${string}`;
const amount = parseUnits('1', 6);

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });

async function main() {
  const seller = privateKeyToAccount(DEPLOYER_KEY);
  const sellerClient = createWalletClient({ account: seller, chain: baseSepolia, transport: http(rpc) });
  const balance = await publicClient.getBalance({ address: seller.address });
  console.log(`Seller (deployer) ${seller.address}: ${formatEther(balance)} ETH on Base Sepolia`);
  console.log(`Escrow ${escrow}, test USDC ${usdc}`);
  if (!SEND) {
    console.log('Dry run. Re-run with --send to create the order.');
    return;
  }

  const buyer = privateKeyToAccount(generatePrivateKey());
  const buyerClient = createWalletClient({ account: buyer, chain: baseSepolia, transport: http(rpc) });
  console.log(`Buyer (throwaway) ${buyer.address}`);

  const wait = async (hash: `0x${string}`, label: string) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`${label} reverted: ${hash}`);
    console.log(`  ✓ ${label}: https://sepolia.basescan.org/tx/${hash}`);
    return receipt;
  };

  // Load-balanced RPCs can lag a block behind a receipt, so confirm each state change before the next step.
  const until = async (label: string, check: () => Promise<boolean>) => {
    for (let i = 0; i < 30; i++) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const usdcRead = (functionName: 'balanceOf' | 'allowance', args: readonly `0x${string}`[]) =>
    publicClient.readContract({ address: usdc, abi: Erc20Abi, functionName, args } as never) as Promise<bigint>;

  await wait(await sellerClient.sendTransaction({ to: buyer.address, value: parseEther('0.00002') }), 'gas for the buyer');
  await until('buyer gas', async () => (await publicClient.getBalance({ address: buyer.address })) > 0n);
  await wait(await buyerClient.writeContract({ address: usdc, abi: Erc20Abi, functionName: 'mint', args: [buyer.address, amount] }), 'mint 1 test USDC');
  await until('buyer USDC', async () => (await usdcRead('balanceOf', [buyer.address])) >= amount);
  await wait(await buyerClient.writeContract({ address: usdc, abi: Erc20Abi, functionName: 'approve', args: [escrow, amount] }), 'approve');
  await until('allowance', async () => (await usdcRead('allowance', [buyer.address, escrow])) >= amount);

  const funded = await wait(
    await buyerClient.writeContract({
      address: escrow,
      abi: MarketplaceEscrowAbi,
      functionName: 'createAndFundOrder',
      args: [seller.address, usdc, amount, 1n],
    }),
    'createAndFundOrder'
  );
  const [fundedLog] = parseEventLogs({ abi: MarketplaceEscrowAbi, logs: funded.logs, eventName: 'OrderFunded' });
  const orderId = fundedLog.args.orderId;
  console.log(`  order #${orderId}`);
  await until('funded order', async () => {
    const order = (await publicClient.readContract({ address: escrow, abi: MarketplaceEscrowAbi, functionName: 'orders', args: [orderId] })) as readonly unknown[];
    return Number(order[7]) === 1; // Funded
  });

  const deliveryHash = `0x${createHash('sha256').update(`claim-payment test delivery for order ${orderId}`).digest('hex')}` as `0x${string}`;
  const delivered = await wait(
    await sellerClient.writeContract({ address: escrow, abi: MarketplaceEscrowAbi, functionName: 'submitDelivery', args: [orderId, deliveryHash] }),
    'submitDelivery'
  );
  const [deliveredLog] = parseEventLogs({ abi: MarketplaceEscrowAbi, logs: delivered.logs, eventName: 'DeliverySubmitted' });
  const claimFrom = new Date(Number(deliveredLog.args.autoReleaseTime) * 1000);
  console.log(`\nOrder #${orderId} delivered. The seller can claim the payment from ${claimFrom.toISOString()}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
