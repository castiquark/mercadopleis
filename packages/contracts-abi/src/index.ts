import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { MarketplaceEscrowAbi } from './MarketplaceEscrowAbi';

export { MarketplaceEscrowAbi };

export const ESCROW_ADDRESSES: Record<number, `0x${string}`> = {
  // Base Sepolia Testnet (Deployed on Base Sepolia)
  [CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID]: '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48',
  // Base Mainnet
  [CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID]: '0x0000000000000000000000000000000000000000',
};

/**
 * Calculates platform fee and seller net payout matching smart contract arithmetic exactly.
 */
export function calculateOrderAmounts(grossAmountUsdc: number, feeBps: number = CONTRACT_CONFIG.INITIAL_FEE_BPS) {
  const platformFeeUsdc = Number(((grossAmountUsdc * feeBps) / CONTRACT_CONFIG.FEE_DENOMINATOR).toFixed(2));
  const sellerAmountUsdc = Number((grossAmountUsdc - platformFeeUsdc).toFixed(2));
  return {
    grossAmountUsdc,
    platformFeeUsdc,
    sellerAmountUsdc,
    feeBps,
  };
}

/**
 * Standard ERC20 minimal ABI for token approvals and balances (USDC)
 */
export const Erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const MockUsdcAbi = Erc20Abi;
