import { NextRequest, NextResponse } from 'next/server';
import { db, services, users } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category');
  try {
    const whereClause = eq(services.isActive, true);

    const allServices = await db.query.services.findMany({
      where: whereClause,
      orderBy: [desc(services.createdAt)],
      with: {
        seller: {
          columns: {
            id: true,
            walletAddress: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    const filtered = category && category !== 'all'
      ? (allServices as any[]).filter((s: any) => s.category?.toLowerCase() === category.toLowerCase())
      : allServices;

    return NextResponse.json({ services: filtered || [] });
  } catch (err: any) {
    console.warn('Database query notice, returning empty catalog:', err?.message);
    return NextResponse.json({ services: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUserFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const { title, description, category, priceUsdc, deliveryDays, coverImageUrl, sellerWallet } = body;

    if (!title || !description || !category || !priceUsdc || !deliveryDays) {
      return NextResponse.json({ error: 'Missing required service fields' }, { status: 400 });
    }

    let sellerId = authUser?.id;

    if (!sellerId && sellerWallet) {
      const normalized = sellerWallet.toLowerCase();
      let user = await db.query.users.findFirst({
        where: eq(users.walletAddress, normalized),
      });

      if (!user) {
        const shortAddr = `${sellerWallet.slice(0, 6)}...${sellerWallet.slice(-4)}`;
        const randomSuffix = Math.floor(Math.random() * 10000);
        const [newUser] = await db
          .insert(users)
          .values({
            walletAddress: normalized,
            username: `user_${sellerWallet.slice(2, 8)}_${randomSuffix}`,
            displayName: shortAddr,
            role: 'USER',
          })
          .returning();
        user = newUser;
      }
      sellerId = user?.id;
    }

    if (!sellerId) {
      return NextResponse.json({ error: 'Unauthorized or wallet missing' }, { status: 401 });
    }

    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') + `-${Date.now().toString(36)}`;

    const [newService] = await db
      .insert(services)
      .values({
        sellerId,
        title,
        slug,
        description,
        category,
        priceUsdc: priceUsdc.toString(),
        deliveryDays: parseInt(deliveryDays.toString(), 10),
        coverImageUrl: coverImageUrl || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ service: newService }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating service:', err);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

