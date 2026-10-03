import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { MarketplaceEscrowAbi } from './MarketplaceEscrowAbi';

export { MarketplaceEscrowAbi };

export const ESCROW_ADDRESSES: Record<number, `0x${string}`> = {
  // Base Sepolia: fixed-fee escrow v2 (verified on BaseScan and Sourcify)
  [CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID]: '0x41880C194F31b1D9AbAC53513De176f2892315EA',
  // Base Mainnet: fixed-fee escrow v2 (verified on BaseScan and Sourcify). v1 0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48 is deprecated.
  [CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID]: '0x18E51cB821A90EE1DA678492DdFDBe54332f35f3',
};

/**
 * Block in which each escrow was deployed. The indexer starts here when it has no checkpoint, so orders created
 * before the first sync are never missed. Fill this in right after deploying a new escrow.
 */
export const ESCROW_DEPLOY_BLOCKS: Record<number, number | undefined> = {
  [CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID]: 47611736,
  [CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID]: 52101644,
};

/**
 * Calculates platform fee and seller net payout matching smart contract arithmetic exactly.
 */
export function calculateOrderAmounts(grossAmountUsdc: number, feeBps: number = CONTRACT_CONFIG.FEE_BPS) {
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
