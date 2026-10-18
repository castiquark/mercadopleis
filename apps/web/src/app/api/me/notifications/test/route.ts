import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { notify } from '@/lib/notify';

/** Sends a test notification to every channel the signed-in user enabled. */
export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await enforceRateLimit([{ name: 'notify:test', id: authUser.id, limit: 5, windowSeconds: 600 }]);
  if (limited) return limited;
  await notify([authUser.id], { type: 'test' }, `test:${authUser.id}:${Date.now()}`);
  return NextResponse.json({ ok: true });
}
