import { NextRequest, NextResponse } from 'next/server';
import { db, services } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';

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
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ service });
  } catch (err: any) {
    console.warn('Database offline, matching fallback service:', err?.message);
    const { slug } = await params;
    const fallbackService = {
      id: 's-1',
      sellerId: 'user-1',
      title: 'Desarrollo de Smart Contract Escrow o ERC20 en Solidity',
      slug,
      description: 'Desarrollo integral de smart contracts con Foundry y OpenZeppelin. Pruebas unitarias, fuzz testing de invariantes matemáticas, optimización de gas y scripts de despliegue para Base.',
      category: 'development',
      priceUsdc: '250.00',
      deliveryDays: 4,
      isActive: true,
      seller: {
        id: 'user-1',
        walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        displayName: 'Pablo C.',
        username: 'pablo',
      },
      orders: [],
    };
    return NextResponse.json({ service: fallbackService });
  }
}
