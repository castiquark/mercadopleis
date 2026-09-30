import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mercadopleis_super_secret_jwt_key_change_in_production';

import { db, users } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';

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
  const user = await db.query.users.findFirst({
    where: eq(users.walletAddress, normalized),
  });

  if (!user || !user.nonce) {
    return { isValid: false, error: 'Nonce expired or not found. Request a new challenge nonce.' };
  }

  if (user.nonce !== clientNonce) {
    return { isValid: false, error: 'Provided nonce does not match current challenge for this wallet' };
  }

  // Check timestamp expiration embedded in nonce
  const parts = user.nonce.split('_');
  if (parts.length === 2) {
    const expiresAt = Number(parts[1]);
    if (!isNaN(expiresAt) && Date.now() > expiresAt) {
      await db.update(users).set({ nonce: null }).where(eq(users.id, user.id));
      return { isValid: false, error: 'Nonce has expired. Please request a new nonce.' };
    }
  }

  // Atomically invalidate nonce after single use to prevent replay attacks
  await db
    .update(users)
    .set({ nonce: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

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
