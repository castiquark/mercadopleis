import { NextRequest, NextResponse } from 'next/server';
import { db, services, users } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category');
  const capability = request.nextUrl.searchParams.get('capability')?.toLowerCase().trim();
  const minPrice = request.nextUrl.searchParams.get('minPrice');
  const maxPrice = request.nextUrl.searchParams.get('maxPrice');
  const maxDeliveryDays = request.nextUrl.searchParams.get('maxDeliveryDays');
  const deliveryType = request.nextUrl.searchParams.get('deliveryType');
  const country = request.nextUrl.searchParams.get('country');
  const city = request.nextUrl.searchParams.get('city');
  const locality = request.nextUrl.searchParams.get('locality');
  const search = request.nextUrl.searchParams.get('search')?.toLowerCase().trim();

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

    let filtered = (allServices as any[]) || [];

    if (category && category !== 'all') {
      filtered = filtered.filter((s: any) => s.category?.toLowerCase() === category.toLowerCase());
    }

    if (capability) {
      const tokens = capability.replace(/[-_]+/g, ' ').split(/\s+/).filter(Boolean);
      filtered = filtered.filter((s: any) => {
        const text = `${s.title} ${s.description} ${s.category} ${s.slug}`.toLowerCase();
        return tokens.some((token) => text.includes(token));
      });
    }

    if (minPrice) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        filtered = filtered.filter((s: any) => parseFloat(s.priceUsdc) >= min);
      }
    }

    if (maxPrice) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        filtered = filtered.filter((s: any) => parseFloat(s.priceUsdc) <= max);
      }
    }

    if (maxDeliveryDays) {
      const maxDays = parseInt(maxDeliveryDays, 10);
      if (!isNaN(maxDays)) {
        filtered = filtered.filter((s: any) => s.deliveryDays <= maxDays);
      }
    }

    if (deliveryType && deliveryType !== 'all') {
      filtered = filtered.filter((s: any) => {
        const type = s.deliveryType || 'digital';
        if (deliveryType === 'in_person') {
          return type === 'in_person' || type === 'both';
        }
        if (deliveryType === 'digital') {
          return type === 'digital' || type === 'both';
        }
        return type === deliveryType;
      });
    }

    if (country) {
      const cLower = country.toLowerCase().trim();
      filtered = filtered.filter((s: any) => s.country?.toLowerCase().includes(cLower));
    }

    if (city) {
      const cityLower = city.toLowerCase().trim();
      filtered = filtered.filter((s: any) => s.city?.toLowerCase().includes(cityLower));
    }

    if (locality) {
      const locLower = locality.toLowerCase().trim();
      filtered = filtered.filter((s: any) => s.locality?.toLowerCase().includes(locLower));
    }

    if (search) {
      filtered = filtered.filter((s: any) =>
        s.title?.toLowerCase().includes(search) ||
        s.description?.toLowerCase().includes(search) ||
        s.locality?.toLowerCase().includes(search) ||
        s.city?.toLowerCase().includes(search) ||
        s.country?.toLowerCase().includes(search)
      );
    }

    const formattedServices = filtered.map((s: any) => ({
      ...s,
      price: {
        amount: s.priceUsdc,
        currency: 'USDC',
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
      },
      settlement: {
        network: 'Base',
        chainId: 8453,
        method: 'smart_contract_escrow',
        escrowContract: '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48',
        feeBps: 300,
        reviewWindowDays: 5,
      },
    }));

    return NextResponse.json(
      {
        protocol: 'Mercadopleis Agent Commerce v1',
        network: 'Base Mainnet',
        chainId: 8453,
        escrowContract: '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48',
        acceptedToken: {
          symbol: 'USDC',
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          decimals: 6,
        },
        count: formattedServices.length,
        services: formattedServices || [],
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.warn('Database query notice, returning empty catalog:', err?.message);
    return NextResponse.json(
      {
        protocol: 'Mercadopleis Agent Commerce v1',
        network: 'Base Mainnet',
        chainId: 8453,
        escrowContract: '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48',
        count: 0,
        services: [],
      },
      { headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUserFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const {
      title,
      description,
      category,
      priceUsdc,
      deliveryDays,
      coverImageUrl,
      sellerWallet,
      deliveryType,
      country,
      city,
      locality,
      addressOrReference,
    } = body;

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
        deliveryType: deliveryType || 'digital',
        country: country || null,
        city: city || null,
        locality: locality || null,
        addressOrReference: addressOrReference || null,
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

