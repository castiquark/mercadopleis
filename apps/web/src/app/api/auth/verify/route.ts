import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { db, users } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { validateAndConsumeNonce, signUserToken } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, signature, message } = body;

    if (!address || !signature || !message) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const normalized = address.toLowerCase();
    const nonceValid = validateAndConsumeNonce(normalized);
    if (!nonceValid) {
      return NextResponse.json({ error: 'Nonce expired or not found. Request a new nonce.' }, { status: 400 });
    }

    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid cryptographic signature' }, { status: 401 });
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
