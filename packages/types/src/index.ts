/**
 * @mercadopleis/types
 * Core domain types and contracts interfaces
 */

export type OrderStatus =
  | 'CREATED'
  | 'FUNDED'
  | 'DELIVERED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'RESOLVED'
  | 'CANCELLED';

export type UserRole = 'USER' | 'ARBITRATOR' | 'ADMIN';

export type ServiceCategory =
  | 'development'
  | 'design'
  | 'marketing'
  | 'consulting';

export interface CategoryInfo {
  id: ServiceCategory;
  name: string;
  description: string;
  icon: string;
}

export const MARKETPLACE_CATEGORIES: CategoryInfo[] = [
  {
    id: 'development',
    name: 'Desarrollo & Smart Contracts',
    description: 'Websites, DApps, Solidity, APIs, Backend y Frontend',
    icon: 'Code',
  },
  {
    id: 'design',
    name: 'Diseño UI/UX & Creativo',
    description: 'Prototipos Figma, landing pages, logos, diseño Web3',
    icon: 'Palette',
  },
  {
    id: 'marketing',
    name: 'Marketing & Redacción',
    description: 'Contenido técnico, traducción, community management, SEO',
    icon: 'Megaphone',
  },
  {
    id: 'consulting',
    name: 'Consultoría & Asesoría Web3',
    description: 'Tokenomics, arquitectura técnica, auditoría preliminar',
    icon: 'Briefcase',
  },
];

export interface User {
  id: string;
  walletAddress: `0x${string}`;
  smartAccountAddress?: `0x${string}` | null;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  country?: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  sellerId: string;
  seller?: User;
  title: string;
  slug: string;
  description: string;
  category: ServiceCategory;
  priceUsdc: number; // Decimal USDC amount (e.g. 150.00)
  deliveryDays: number;
  coverImageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  contractOrderId?: number | null; // ID assigned by smart contract
  serviceId: string;
  service?: Service;
  buyerId: string;
  buyer?: User;
  sellerId: string;
  seller?: User;
  chainId: number;
  grossAmountUsdc: number; // Total price paid by buyer (e.g. 100.00)
  platformFeeBps: number; // Fee in basis points (e.g. 300 = 3%)
  platformFeeUsdc: number; // e.g. 3.00
  sellerAmountUsdc: number; // e.g. 97.00
  status: OrderStatus;
  deadlineTimestamp: number; // Unix timestamp
  deliveryHash?: `0x${string}` | null; // bytes32 delivery hash
  deliveryReferenceUrl?: string | null; // Private storage URL or reference
  deliveredAt?: string | null;
  releasedAt?: string | null;
  autoReleaseDeadline?: number | null; // Unix timestamp for 5 days after delivery
  txHashFunding?: `0x${string}` | null;
  txHashRelease?: `0x${string}` | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  openedById: string;
  openedBy?: User;
  reason: string;
  evidenceUrl?: string | null;
  status: 'OPEN' | 'RESOLVED';
  arbitratorId?: string | null;
  sellerAwardUsdc?: number | null;
  buyerRefundUsdc?: number | null;
  resolutionNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface Review {
  id: string;
  orderId: string;
  reviewerId: string;
  reviewedUserId: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}

// Smart Contract Constants
export const CONTRACT_CONFIG = {
  FEE_DENOMINATOR: 10_000,
  INITIAL_FEE_BPS: 300, // 3%
  MAX_FEE_BPS: 1_000, // 10% hard cap
  AUTO_RELEASE_DURATION_SECONDS: 5 * 24 * 60 * 60, // 5 days (120 hours)
  BASE_SEPOLIA_CHAIN_ID: 84532,
  BASE_MAINNET_CHAIN_ID: 8453,
  // Standard USDC addresses
  USDC_BASE_SEPOLIA: '0x6Fa1279f6c760fA993B7f9aC75de5a141d7D2D8A' as `0x${string}`, // Mintable Testnet USDC on Base Sepolia
  USDC_BASE_SEPOLIA_OFFICIAL: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
  USDC_BASE_MAINNET: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
} as const;
