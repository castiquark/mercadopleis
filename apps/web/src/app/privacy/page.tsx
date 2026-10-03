import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { PRIVACY } from '@/lib/legalContent';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Privacy Policy — mercadopleis',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <LegalDocument content={PRIVACY} />;
}
