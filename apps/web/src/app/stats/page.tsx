import type { Metadata } from 'next';
import { StatsView } from '@/components/StatsView';

export const metadata: Metadata = {
  title: 'Operación 100 | Operation 100 — mercadopleis',
  description: 'Public, verifiable traction of Mercadopleis: completed orders, volume and sellers on Base Mainnet.',
  alternates: { canonical: '/stats' },
};

export default function StatsPage() {
  return <StatsView />;
}
