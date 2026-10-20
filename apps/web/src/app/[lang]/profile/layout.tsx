import { NOINDEX } from '@/lib/seo';

export const metadata = NOINDEX;

export default function NoindexLayout({ children }: { children: React.ReactNode }) {
  return children;
}
