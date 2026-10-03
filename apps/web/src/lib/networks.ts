import { ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

export interface ResolvedNetwork {
  chainId: number;
  supported: boolean;
  isTestnet: boolean;
  escrow: `0x${string}`;
  usdc: `0x${string}`;
}

const MAINNET = CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID;
const SEPOLIA = CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;

/**
 * Maps the wallet's chain to the escrow and USDC addresses. Disconnected wallets resolve to Base Mainnet.
 * Any other chain is reported as unsupported and keeps the Mainnet addresses so callers can never
 * silently send a transaction to testnet addresses (the escrow address is identical on both chains).
 */
export function resolveNetwork(walletChainId?: number | null): ResolvedNetwork {
  const chainId = walletChainId ?? MAINNET;
  const supported = chainId === MAINNET || chainId === SEPOLIA;
  const effective = chainId === SEPOLIA ? SEPOLIA : MAINNET;
  return {
    chainId,
    supported,
    isTestnet: effective === SEPOLIA,
    escrow: ESCROW_ADDRESSES[effective],
    usdc: effective === SEPOLIA ? CONTRACT_CONFIG.USDC_BASE_SEPOLIA : CONTRACT_CONFIG.USDC_BASE_MAINNET,
  };
}
