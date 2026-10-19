import type { Metadata } from 'next';
import HomeClient from './HomeClient';

// Title, description and social cards come from the root layout; only the canonical is set here,
// so that pages without their own canonical do not point at the home page.
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function HomePage() {
  return <HomeClient />;
}
