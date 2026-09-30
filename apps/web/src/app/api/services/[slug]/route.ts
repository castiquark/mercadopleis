import { NextRequest, NextResponse } from 'next/server';
import { db, services } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';

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
    const service = await db.query.services.findFirst({
      where: eq(services.slug, slug),
      with: {
        seller: {
          columns: {
            id: true,
            walletAddress: true,
            smartAccountAddress: true,
            displayName: true,
            username: true,
            bio: true,
            avatarUrl: true,
            country: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        orders: true,
      },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      {
        protocol: 'Mercadopleis Escrow Protocol v1',
        network: 'Base Mainnet',
        chainId: 8453,
        escrowContract: '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48',
        service,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.warn('Database query notice:', err?.message);
    return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS_HEADERS });
  }
}


