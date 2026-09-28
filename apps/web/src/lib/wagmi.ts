import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia, base } from 'wagmi/chains';
import { http } from 'wagmi';

export const wagmiConfig = getDefaultConfig({
  appName: 'mercadopleis',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64',
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'),
  },
  ssr: true,
});
