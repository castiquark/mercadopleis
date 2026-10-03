import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { TERMS } from '@/lib/legalContent';

export const metadata: Metadata = {
  title: 'Términos del Servicio | Terms of Service — mercadopleis',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <LegalDocument content={TERMS} />;
}
