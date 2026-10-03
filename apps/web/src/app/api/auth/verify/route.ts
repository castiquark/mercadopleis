import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { db, users } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { validateAndConsumeNonce, signUserToken } from '@/lib/serverAuth';
import { parseSiweMessage, validateSiweMessage } from '@/lib/siwe';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit([{ name: 'auth:verify:ip', id: getClientIp(request), limit: 20, windowSeconds: 60 }]);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { address, signature, message } = body;

    if (!address || !signature || !message) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const normalized = address.toLowerCase();

    // 1. Strict EIP-4361 SIWE message validation
    const parsed = parseSiweMessage(message);
    if (!parsed) {
      return NextResponse.json({ error: 'Malformed EIP-4361 SIWE message format' }, { status: 400 });
    }

    if (parsed.address.toLowerCase() !== normalized) {
      return NextResponse.json(
        { error: 'SIWE message address does not match signing wallet' },
        { status: 400 }
      );
    }

    // Validate version, domain, URI authority, chain id and freshness
    const reqHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const validation = validateSiweMessage(parsed, {
      reqHost,
      isProduction: process.env.NODE_ENV === 'production',
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 2. Cryptographic signature verification (before touching the nonce)
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid cryptographic signature' }, { status: 401 });
    }

    // 3. Validate & atomically consume durable nonce from PostgreSQL
    const nonceResult = await validateAndConsumeNonce(normalized, parsed.nonce);
    if (!nonceResult.isValid) {
      return NextResponse.json(
        { error: nonceResult.error || 'Nonce expired or invalid. Request a new challenge nonce.' },
        { status: 400 }
      );
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalized),
    });

    const { isAdminWallet } = await import('@mercadopleis/types');
    const isFeeCollectorAdmin = isAdminWallet(normalized);
    let userRole = isFeeCollectorAdmin ? 'ADMIN' : 'USER';
    let userId: string;

    if (!existingUser) {
      const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const randomSuffix = Math.floor(Math.random() * 10000);
      const username = isFeeCollectorAdmin ? 'admin' : `user_${address.slice(2, 8)}_${randomSuffix}`;
      const displayName = isFeeCollectorAdmin ? 'Administrador' : shortAddr;

      const [newUser] = await db
        .insert(users)
        .values({
          walletAddress: normalized,
          username,
          displayName,
          role: userRole,
        })
        .returning();

      userId = newUser.id;
    } else {
      userId = existingUser.id;
      if (isFeeCollectorAdmin && existingUser.role !== 'ADMIN') {
        userRole = 'ADMIN';
        await db
          .update(users)
          .set({ role: 'ADMIN', updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
      } else if (!isFeeCollectorAdmin && existingUser.role === 'ADMIN') {
        // Demote any non-admin wallet that was incorrectly assigned ADMIN
        userRole = 'USER';
        await db
          .update(users)
          .set({ role: 'USER', updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
      } else {
        userRole = existingUser.role;
      }
    }

    const token = signUserToken({
      id: userId,
      walletAddress: normalized,
      role: userRole,
    });

    return NextResponse.json({
      token,
      user: {
        id: userId,
        walletAddress: normalized,
        role: userRole,
      },
    });
  } catch (err: any) {
    console.error('SIWE verification error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
