import { NextRequest, NextResponse } from 'next/server';
import { db, services } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category');
    let whereClause = eq(services.isActive, true);

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

    return NextResponse.json({ services: filtered });
  } catch (err: any) {
    console.error('Error fetching services:', err);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, category, priceUsdc, deliveryDays, coverImageUrl } = body;

    if (!title || !description || !category || !priceUsdc || !deliveryDays) {
      return NextResponse.json({ error: 'Missing required service fields' }, { status: 400 });
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
        sellerId: authUser.id,
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
