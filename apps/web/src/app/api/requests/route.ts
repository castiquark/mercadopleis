import { NextRequest, NextResponse } from 'next/server';
import { db, requests } from '@mercadopleis/database';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { validateRequestInput } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rateLimit';
import { REQUEST_STATUSES, slugify } from '@/lib/requests';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Public list of requests (open ones by default). Proposal prices are never included here. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const statusParam = (params.get('status') || 'OPEN').toUpperCase();
  const status = (REQUEST_STATUSES as readonly string[]).includes(statusParam) ? statusParam : 'OPEN';
  const category = params.get('category');
  const search = params.get('search')?.trim();
  const limit = Math.min(Math.max(parseInt(params.get('limit') || '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(params.get('offset') || '0', 10) || 0, 0);

  try {
    const conditions = [eq(requests.status, status)];
    if (category && category !== 'all') conditions.push(eq(requests.category, category));
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(ilike(requests.title, term), ilike(requests.description, term))!);
    }

    const rows = await db.query.requests.findMany({
      where: and(...conditions),
      orderBy: [desc(requests.createdAt)],
      limit,
      offset,
      with: {
        buyer: { columns: { displayName: true, walletAddress: true } },
        proposals: { columns: { id: true } },
      },
    });

    const list = rows.map(({ proposals, ...r }: any) => ({ ...r, proposalCount: proposals.length }));
    return NextResponse.json({ count: list.length, requests: list }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('Error listing requests:', err);
    return NextResponse.json({ error: 'Requests are temporarily unavailable' }, { status: 503, headers: CORS_HEADERS });
  }
}

/** Post a request. Any signed-in wallet (person or agent) can do it. */
export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized: sign in with your wallet to post a request' }, { status: 401, headers: CORS_HEADERS });
  }

  const limited = await enforceRateLimit([{ name: 'requests:create', id: authUser.id, limit: 10, windowSeconds: 3600 }]);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const input = validateRequestInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400, headers: CORS_HEADERS });

  try {
    const [created] = await db
      .insert(requests)
      .values({
        ...input.value,
        buyerId: authUser.id,
        slug: slugify(input.value.title, Date.now().toString(36)),
      })
      .returning();
    return NextResponse.json({ request: created }, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    console.error('Error creating request:', err);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500, headers: CORS_HEADERS });
  }
}
