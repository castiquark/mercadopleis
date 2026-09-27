import { NextRequest, NextResponse } from 'next/server';
import { generateNonceForAddress } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.toLowerCase();
  if (!address || !address.startsWith('0x')) {
    return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
  }

  const nonce = generateNonceForAddress(address);
  return NextResponse.json({ nonce });
}
