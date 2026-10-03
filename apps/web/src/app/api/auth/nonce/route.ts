import { NextRequest, NextResponse } from 'next/server';
import { generateNonceForAddress } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.toLowerCase();
  if (!address || !address.startsWith('0x')) {
    return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
  }

  const limited = await enforceRateLimit([
    { name: 'auth:nonce:ip', id: getClientIp(request), limit: 20, windowSeconds: 60 },
    { name: 'auth:nonce:addr', id: address, limit: 5, windowSeconds: 60 },
  ]);
  if (limited) return limited;

  const nonce = await generateNonceForAddress(address);
  return NextResponse.json({ nonce });
}
