import { CONTRACT_CONFIG } from '@mercadopleis/types';

export interface ReputationStats {
  completed: number;
  successRate: number | null;
  avgRating: number | null;
  reviewCount: number;
  openDisputes: number;
  volumeUsdc: number;
}

export const EMPTY_STATS: ReputationStats = { completed: 0, successRate: null, avgRating: null, reviewCount: 0, openDisputes: 0, volumeUsdc: 0 };

// Reputation is derived only from real Base Mainnet orders of the signed-in user (testnet orders never count).
export function computeStats(orders: any[], userId: string): ReputationStats {
  const mainnet = orders.filter((o) => (o.chainId ?? CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID) === CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID);
  const asSeller = mainnet.filter((o) => o.sellerId === userId);

  const completed = asSeller.filter((o) => o.status === 'RELEASED').length;
  const finished = asSeller.filter((o) => ['RELEASED', 'REFUNDED', 'RESOLVED'].includes(o.status)).length;
  const ratings = asSeller.map((o) => o.review?.rating).filter((r): r is number => typeof r === 'number');

  return {
    completed,
    successRate: finished > 0 ? Math.round((completed / finished) * 100) : null,
    avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    reviewCount: ratings.length,
    openDisputes: mainnet.filter((o) => o.status === 'DISPUTED' || o.dispute?.status === 'OPEN').length,
    volumeUsdc: mainnet
      .filter((o) => o.status === 'RELEASED' || o.status === 'RESOLVED')
      .reduce((sum, o) => sum + (parseFloat(o.grossAmountUsdc) || 0), 0),
  };
}
