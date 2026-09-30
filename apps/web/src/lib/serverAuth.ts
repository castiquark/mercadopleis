import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mercadopleis_super_secret_jwt_key_change_in_production';

import { db, users } from '@mercadopleis/database';
import { eq, and } from 'drizzle-orm';

export interface TokenPayload {
  id: string;
  walletAddress: string;
  role: string;
}

export async function generateNonceForAddress(address: string): Promise<string> {
  const normalized = address.toLowerCase();
  const rawNonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiration
  const nonce = `${rawNonce}_${expiresAt}`;

  const existing = await db.query.users.findFirst({
    where: eq(users.walletAddress, normalized),
  });

  if (existing) {
    await db
      .update(users)
      .set({ nonce, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
  } else {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const randomSuffix = Math.floor(Math.random() * 10000);
    await db.insert(users).values({
      walletAddress: normalized,
      username: `user_${address.slice(2, 8)}_${randomSuffix}`,
      displayName: shortAddr,
      nonce,
      role: 'USER',
    });
  }

  return nonce;
}

export async function validateAndConsumeNonce(
  address: string,
  clientNonce: string
): Promise<{ isValid: boolean; error?: string }> {
  if (!clientNonce) {
    return { isValid: false, error: 'Nonce is required in signed authentication payload' };
  }

  const normalized = address.toLowerCase();

  // Check timestamp expiration embedded in nonce
  const parts = clientNonce.split('_');
  if (parts.length === 2) {
    const expiresAt = Number(parts[1]);
    if (!isNaN(expiresAt) && Date.now() > expiresAt) {
      // Invalidate if found in DB
      await db
        .update(users)
        .set({ nonce: null, updatedAt: new Date() })
        .where(and(eq(users.walletAddress, normalized), eq(users.nonce, clientNonce)));
      return { isValid: false, error: 'Nonce has expired. Please request a new nonce.' };
    }
  }

  // Atomically consume nonce in a single SQL operation:
  // UPDATE users SET nonce = NULL, updatedAt = NOW() WHERE wallet_address = normalized AND nonce = clientNonce RETURNING *
  const updated = await db
    .update(users)
    .set({ nonce: null, updatedAt: new Date() })
    .where(and(eq(users.walletAddress, normalized), eq(users.nonce, clientNonce)))
    .returning();

  if (!updated || updated.length === 0) {
    return {
      isValid: false,
      error: 'Nonce invalid, already consumed, or expired. Request a new challenge nonce.',
    };
  }

  return { isValid: true };
}

export function signUserToken(user: TokenPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function getAuthUserFromRequest(request: Request): TokenPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
