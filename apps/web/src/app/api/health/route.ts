import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'mercadopleis-unified-api',
    platform: 'netlify-nextjs',
    defaultChainId: 8453,
    supportedChainIds: [8453, 84532],
    timestamp: new Date().toISOString(),
  });
}
