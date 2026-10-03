import { NextRequest, NextResponse } from 'next/server';
import { db, services, users } from '@mercadopleis/database';
import { eq, desc, and, gte, lte, ilike, or } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { validateServiceInput } from '@/lib/validation';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

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

  // Pagination parameters
  const limitParam = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
  const limit = isNaN(limitParam) ? 20 : Math.min(Math.max(limitParam, 1), 100);

  const offsetParam = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);
  const pageParam = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
  const offset = !isNaN(offsetParam) && offsetParam > 0
    ? offsetParam
    : !isNaN(pageParam) && pageParam > 1
      ? (pageParam - 1) * limit
      : 0;

  try {
    const conditions: any[] = [eq(services.isActive, true)];

    if (category && category !== 'all') {
      conditions.push(eq(services.category, category));
    }

    if (minPrice) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        conditions.push(gte(services.priceUsdc, min.toString()));
      }
    }

    if (maxPrice) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        conditions.push(lte(services.priceUsdc, max.toString()));
      }
    }

    if (maxDeliveryDays) {
      const maxDays = parseInt(maxDeliveryDays, 10);
      if (!isNaN(maxDays)) {
        conditions.push(lte(services.deliveryDays, maxDays));
      }
    }

    if (deliveryType && deliveryType !== 'all') {
      if (deliveryType === 'in_person') {
        conditions.push(or(eq(services.deliveryType, 'in_person'), eq(services.deliveryType, 'both')));
      } else if (deliveryType === 'digital') {
        conditions.push(or(eq(services.deliveryType, 'digital'), eq(services.deliveryType, 'both')));
      } else {
        conditions.push(eq(services.deliveryType, deliveryType));
      }
    }

    if (country) {
      conditions.push(ilike(services.country, `%${country.trim()}%`));
    }

    if (city) {
      conditions.push(ilike(services.city, `%${city.trim()}%`));
    }

    if (locality) {
      conditions.push(ilike(services.locality, `%${locality.trim()}%`));
    }

    if (search) {
      const sTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(services.title, sTerm),
          ilike(services.description, sTerm),
          ilike(services.locality, sTerm),
          ilike(services.city, sTerm),
          ilike(services.country, sTerm)
        )
      );
    }

    if (capability) {
      const tokens = capability.replace(/[-_]+/g, ' ').split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        const tokenConditions = tokens.map((token) =>
          or(
            ilike(services.title, `%${token}%`),
            ilike(services.description, `%${token}%`),
            ilike(services.category, `%${token}%`),
            ilike(services.slug, `%${token}%`)
          )
        );
        conditions.push(or(...tokenConditions));
      }
    }

    const queriedServices = await db.query.services.findMany({
      where: and(...conditions),
      orderBy: [desc(services.createdAt)],
      limit,
      offset,
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

    const formattedServices = queriedServices.map((s: any) => ({
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
        escrowContract: ESCROW_ADDRESSES[8453],
        feeBps: CONTRACT_CONFIG.FEE_BPS,
        reviewWindowDays: 5,
      },
    }));

    return NextResponse.json(
      {
        protocol: 'Mercadopleis Agent Commerce v1',
        network: 'Base Mainnet',
        chainId: 8453,
        escrowContract: ESCROW_ADDRESSES[8453],
        acceptedToken: {
          symbol: 'USDC',
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          decimals: 6,
        },
        pagination: {
          limit,
          offset,
          count: formattedServices.length,
        },
        count: formattedServices.length,
        services: formattedServices || [],
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    // Do not pretend the catalog is empty: agents would read an outage as "no services exist".
    console.error('Catalog query failed:', err?.message);
    return NextResponse.json(
      { error: 'Catalog temporarily unavailable. Please retry shortly.' },
      { status: 503, headers: { ...CORS_HEADERS, 'Retry-After': '30' } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: You must authenticate with your wallet via SIWE before publishing a service' },
        { status: 401 }
      );
    }

    const limited = await enforceRateLimit([{ name: 'services:create', id: authUser.id, limit: 10, windowSeconds: 3600 }]);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const sellerWallet = typeof body.sellerWallet === 'string' ? body.sellerWallet : undefined;

    const parsed = validateServiceInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.value;

    // Prevent arbitrary wallet spoofing: sellerWallet must match the authenticated wallet address
    if (sellerWallet && sellerWallet.toLowerCase() !== authUser.walletAddress.toLowerCase() && authUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: You cannot publish services under a different wallet address' },
        { status: 403 }
      );
    }

    const sellerId = authUser.id;

    const slug = input.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') + `-${Date.now().toString(36)}`;

    const [newService] = await db
      .insert(services)
      .values({
        sellerId,
        title: input.title,
        slug,
        description: input.description,
        category: input.category,
        priceUsdc: input.priceUsdc,
        deliveryDays: input.deliveryDays,
        deliveryType: input.deliveryType,
        country: input.country,
        city: input.city,
        locality: input.locality,
        addressOrReference: input.addressOrReference,
        coverImageUrl: input.coverImageUrl,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ service: newService }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating service:', err);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

