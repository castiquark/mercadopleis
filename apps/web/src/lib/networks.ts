import { ESCROW_ADDRESSES, ESCROW_V3_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

const chainKey = (chainId: number) => (chainId === 84532 ? 84532 : 8453);

/** The escrow new orders use on a chain: v3 once it has an address there, otherwise v2. */
export function currentEscrow(chainId: number): `0x${string}` {
  const c = chainKey(chainId);
  return ESCROW_V3_ADDRESSES[c] ?? ESCROW_ADDRESSES[c];
}

/** Lowercase address of the escrow currently deployed on a chain; the key that identifies where an order lives. */
export function currentEscrowKey(chainId: number): string {
  return currentEscrow(chainId).toLowerCase();
}

/** Every escrow the web still reads on a chain: v3 (if deployed) and v2, which stays read for older orders. */
export function knownEscrows(chainId: number): `0x${string}`[] {
  const c = chainKey(chainId);
  return [ESCROW_V3_ADDRESSES[c], ESCROW_ADDRESSES[c]].filter((a): a is `0x${string}` => !!a);
}

/** The escrow an order lives in. Rows without an address predate v3 and live in v2. */
export function orderEscrow(chainId: number, escrowAddress?: string | null): `0x${string}` {
  const known = knownEscrows(chainId).find((a) => a.toLowerCase() === escrowAddress?.toLowerCase());
  return known ?? ESCROW_ADDRESSES[chainKey(chainId)];
}

/** True when the address is the chain's v3 escrow (pull payments, effective timers, dispute timeout). */
export function isV3Escrow(chainId: number, escrowAddress?: string | null): boolean {
  const v3 = ESCROW_V3_ADDRESSES[chainKey(chainId)];
  return !!v3 && !!escrowAddress && v3.toLowerCase() === escrowAddress.toLowerCase();
}

export interface ResolvedNetwork {
  chainId: number;
  /** Display name of the network the payment uses. */
  name: string;
  supported: boolean;
  isTestnet: boolean;
  escrow: `0x${string}`;
  /** Settlement stablecoin of the network. Kept as `usdc` for existing callers; see tokenSymbol. */
  usdc: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
}

const MAINNET = CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID;
const SEPOLIA = CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;

/**
 * Maps the wallet's chain to the escrow and USDC addresses. Disconnected wallets resolve to Base Mainnet.
 * Any other chain is reported as unsupported and keeps the Mainnet addresses so callers can never
 * silently send a transaction to testnet addresses.
 */
export function resolveNetwork(walletChainId?: number | null): ResolvedNetwork {
  const chainId = walletChainId ?? MAINNET;
  const supported = chainId === MAINNET || chainId === SEPOLIA;
  const effective = chainId === SEPOLIA ? SEPOLIA : MAINNET;
  return {
    chainId,
    name: effective === SEPOLIA ? 'Base Sepolia' : 'Base Mainnet',
    supported,
    isTestnet: effective === SEPOLIA,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    escrow: currentEscrow(effective),
    usdc: effective === SEPOLIA ? CONTRACT_CONFIG.USDC_BASE_SEPOLIA : CONTRACT_CONFIG.USDC_BASE_MAINNET,
  };
}
