import { NextRequest, NextResponse } from 'next/server';
import { findPublicService } from '@/lib/servicesDb';
import { currentEscrow } from '@/lib/networks';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const service = await findPublicService(slug);

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      {
        protocol: 'Mercadopleis Escrow Protocol v1',
        network: 'Base Mainnet',
        chainId: 8453,
        escrowContract: currentEscrow(8453),
        service,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.warn('Database query notice:', err?.message);
    return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS_HEADERS });
  }
}


