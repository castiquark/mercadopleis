import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'mercadopleis-unified-api',
    platform: 'netlify-nextjs',
    chainId: 84532,
    timestamp: new Date().toISOString(),
  });
}
