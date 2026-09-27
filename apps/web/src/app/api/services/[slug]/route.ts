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
            nonce: true,
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
    console.error('Error fetching service:', err);
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 });
  }
}
