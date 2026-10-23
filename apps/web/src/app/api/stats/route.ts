import { NextResponse } from 'next/server';
import { getPublicStats } from '@/lib/publicStats';

export const dynamic = 'force-dynamic';

// Public traction numbers ("Operation 100"); see lib/publicStats.ts. Every order is an on-chain event anyone can check.
export async function GET() {
  try {
    return NextResponse.json(await getPublicStats(), {
      // Cached at the CDN for 5 minutes: it is public and changes slowly.
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Could not load stats' }, { status: 500 });
  }
}
