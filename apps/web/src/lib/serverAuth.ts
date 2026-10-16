import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const INSECURE_SECRETS = new Set([
  'mercadopleis_super_secret_jwt_key_change_in_production',
  'mercadopleis_development_jwt_secret_key_123',
  'change_me',
]);

// Resolved lazily so `next build` does not require the secret, but any request
// that signs or verifies a token fails closed when it is missing or a known placeholder.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32 || INSECURE_SECRETS.has(secret)) {
      throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in production');
    }
    return secret;
  }
  return secret || 'dev-only-insecure-jwt-secret-do-not-use-in-production';
}

import { db, authNonces } from '@mercadopleis/database';
import { eq, and, gt, lt } from 'drizzle-orm';

export interface TokenPayload {
  id: string;
  walletAddress: string;
  role: string;
}

const NONCE_TTL_MS = 5 * 60 * 1000;

// Nonces live in auth_nonces (one pending challenge per wallet), so requesting one never creates a user.
export async function generateNonceForAddress(address: string): Promise<string> {
  const normalized = address.toLowerCase();
  const rawNonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + NONCE_TTL_MS;
  const nonce = `${rawNonce}_${expiresAt}`;

  await db
    .insert(authNonces)
    .values({ walletAddress: normalized, nonce, expiresAt: new Date(expiresAt) })
    .onConflictDoUpdate({ target: authNonces.walletAddress, set: { nonce, expiresAt: new Date(expiresAt) } });

  // Housekeeping: drop challenges that expired more than an hour ago.
  await db.delete(authNonces).where(lt(authNonces.expiresAt, new Date(Date.now() - 60 * 60 * 1000)));

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
      await db
        .delete(authNonces)
        .where(and(eq(authNonces.walletAddress, normalized), eq(authNonces.nonce, clientNonce)));
      return { isValid: false, error: 'Nonce has expired. Please request a new nonce.' };
    }
  }

  // Consume atomically: the row is deleted only if wallet, nonce and expiry all match, so a nonce works once.
  const consumed = await db
    .delete(authNonces)
    .where(
      and(
        eq(authNonces.walletAddress, normalized),
        eq(authNonces.nonce, clientNonce),
        gt(authNonces.expiresAt, new Date())
      )
    )
    .returning();

  if (!consumed || consumed.length === 0) {
    return {
      isValid: false,
      error: 'Nonce invalid, already consumed, or expired. Request a new challenge nonce.',
    };
  }

  return { isValid: true };
}

export function signUserToken(user: TokenPayload): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: '7d' });
}

export function getAuthUserFromRequest(request: Request): TokenPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
