import { Attribution } from 'ox/erc8021';
import type { Hex } from 'viem';

export const API_URL = (process.env.MERCADOPLEIS_API_URL || 'https://mercadopleis.club').replace(/\/$/, '');
export const CHAIN_ID = Number(process.env.MERCADOPLEIS_CHAIN_ID || 8453);

export const NETWORKS: Record<number, { name: string; rpc: string; usdc: `0x${string}`; explorer: string }> = {
  8453: {
    name: 'Base Mainnet',
    rpc: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    explorer: 'https://basescan.org',
  },
  84532: {
    name: 'Base Sepolia',
    rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    usdc: '0x6Fa1279f6c760fA993B7f9aC75de5a141d7D2D8A',
    explorer: 'https://sepolia.basescan.org',
  },
};

export const ESCROW_ADDRESS = '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48' as const;

// Base Builder Code (ERC-8021): attributes onchain activity to mercadopleis.
export const BUILDER_DATA_SUFFIX: Hex = Attribution.toDataSuffix({ codes: ['bc_dmphihka'] });

export const escrowAbi = [
  {
    type: 'function', name: 'createAndFundOrder', stateMutability: 'nonpayable',
    inputs: [
      { name: 'seller', type: 'address' }, { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }, { name: 'deliveryDays', type: 'uint256' },
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'approveDelivery', stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'orders', stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'buyer', type: 'address' }, { name: 'seller', type: 'address' },
      { name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }, { name: 'autoReleaseTime', type: 'uint256' },
      { name: 'deliveryHash', type: 'bytes32' }, { name: 'status', type: 'uint8' },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

export const ORDER_STATUS = ['None', 'Funded', 'Delivered', 'Released', 'Refunded', 'Disputed', 'Resolved'] as const;
