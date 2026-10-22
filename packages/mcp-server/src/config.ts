import { Attribution } from 'ox/erc8021';
import { defineChain, type Chain, type Hex } from 'viem';
import { base, baseSepolia } from 'viem/chains';

export const API_URL = (process.env.MERCADOPLEIS_API_URL || 'https://mercadopleis.club').replace(/\/$/, '');
export const CHAIN_ID = Number(process.env.MERCADOPLEIS_CHAIN_ID || 8453);

export interface NetworkConfig {
  name: string;
  chain: Chain;
  rpc: string;
  /** Stablecoin the escrow settles in on this network. */
  token: { address: `0x${string}`; symbol: string; decimals: number };
  /** Escrow that new orders go to: v3 when deployed on this network, else v2. */
  escrow: `0x${string}`;
  /** 3 when `escrow` is the pull-payment v3, 2 while the network still runs v2. */
  version: 2 | 3;
  /** Legacy v2 escrow, kept for reading and finishing orders created before v3 (only set once v3 is live). */
  escrowV2?: `0x${string}`;
  explorer: string;
  testnet: boolean;
  /** True when mercadopleis.club indexes this network (order registration, messages, deliverables). */
  api: boolean;
}

const bohr = defineChain({
  id: 968,
  name: 'BOT Chain Testnet (Bohr)',
  nativeCurrency: { name: 'Test BOT', symbol: 'tBOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: { default: { name: 'Bohr Explorer', url: 'https://scan.bohr.life' } },
  testnet: true,
});

const isAddr = (v: string | undefined): v is `0x${string}` => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

// v3 addresses (keep in sync with ESCROW_V3_ADDRESSES in packages/contracts-abi; empty until the deploy).
// MERCADOPLEIS_ESCROW_V3_<chainId> overrides them, e.g. to test a fresh deployment.
const V3_ADDRESSES: Partial<Record<number, `0x${string}`>> = {
  84532: '0x41dfDBCE9635f9c50E8da236C30E2ea2F2f96c5e',
};
const v3For = (chainId: number) => {
  const env = process.env[`MERCADOPLEIS_ESCROW_V3_${chainId}`];
  return isAddr(env) ? env : V3_ADDRESSES[chainId];
};

const NETWORKS_V2: Record<number, NetworkConfig> = {
  8453: {
    name: 'Base Mainnet',
    chain: base,
    rpc: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    token: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    version: 2,
    escrow: '0x18E51cB821A90EE1DA678492DdFDBe54332f35f3', // keep in sync with packages/contracts-abi (guarded by a test)
    explorer: 'https://basescan.org',
    testnet: false,
    api: true,
  },
  84532: {
    name: 'Base Sepolia',
    chain: baseSepolia,
    rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    token: { address: '0x6Fa1279f6c760fA993B7f9aC75de5a141d7D2D8A', symbol: 'USDC', decimals: 6 },
    version: 2,
    escrow: '0x41880C194F31b1D9AbAC53513De176f2892315EA', // keep in sync with packages/contracts-abi (guarded by a test)
    explorer: 'https://sepolia.basescan.org',
    testnet: true,
    api: true,
  },
};

/** Switches each network to v3 once an address exists; the v2 escrow stays reachable as `escrowV2`. */
export const NETWORKS: Record<number, NetworkConfig> = Object.fromEntries(
  Object.entries(NETWORKS_V2).map(([id, n]) => {
    const v3 = v3For(Number(id));
    return [id, v3 ? { ...n, escrow: v3, version: 3 as const, escrowV2: n.escrow } : n];
  })
);

// BOT Chain testnet (Bohr): on-chain tools only, enabled when the test deployment is configured.
//   MERCADOPLEIS_CHAIN_ID=968 MERCADOPLEIS_BOHR_ESCROW=0x... MERCADOPLEIS_BOHR_TOKEN=0x...
const bohrEscrow = process.env.MERCADOPLEIS_BOHR_ESCROW;
const bohrToken = process.env.MERCADOPLEIS_BOHR_TOKEN;
if (isAddr(bohrEscrow) && isAddr(bohrToken)) {
  NETWORKS[968] = {
    name: 'BOT Chain Testnet (Bohr)',
    chain: bohr,
    rpc: process.env.BOHR_RPC_URL || 'https://rpc.bohr.life',
    token: { address: bohrToken, symbol: process.env.MERCADOPLEIS_BOHR_TOKEN_SYMBOL || 'tUSD', decimals: 6 },
    escrow: bohrEscrow,
    version: process.env.MERCADOPLEIS_BOHR_ESCROW_VERSION === '3' ? 3 : 2,
    explorer: 'https://scan.bohr.life',
    testnet: true,
    api: false,
  };
}

/** Network config for a chain id, with a clear error for unsupported or unconfigured networks. */
export function getNetwork(chainId: number): NetworkConfig {
  const net = NETWORKS[chainId];
  if (net) return net;
  if (chainId === 968) {
    throw new Error('BOT Chain testnet (968) is not configured: set MERCADOPLEIS_BOHR_ESCROW and MERCADOPLEIS_BOHR_TOKEN.');
  }
  const list = Object.entries(NETWORKS).map(([id, n]) => `${id} (${n.name})`).join(', ');
  throw new Error(`Unsupported chainId ${chainId}. Supported: ${list}.`);
}

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
    type: 'function', name: 'openDispute', stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'claimTimeoutRefund', stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [],
  },
  // v3 only (pull payments, pause-aware timers)
  {
    type: 'function', name: 'withdraw', stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'to', type: 'address' }], outputs: [],
  },
  {
    type: 'function', name: 'withdrawable', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'claimDisputeTimeout', stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'effectiveDeadline', stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'effectiveAutoReleaseTime', stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'disputeTimeoutAt', stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [{ type: 'uint256' }],
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
