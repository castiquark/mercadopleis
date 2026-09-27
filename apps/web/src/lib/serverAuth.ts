import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mercadopleis_super_secret_jwt_key_change_in_production';

// In-memory nonce cache with expiration (persisted on globalThis to survive HMR/route re-evaluations)
const globalForAuth = globalThis as unknown as {
  nonceMap?: Map<string, { nonce: string; expiresAt: number }>;
};

const nonceMap =
  globalForAuth.nonceMap ?? new Map<string, { nonce: string; expiresAt: number }>();
globalForAuth.nonceMap = nonceMap;

export interface TokenPayload {
  id: string;
  walletAddress: string;
  role: string;
}

export function generateNonceForAddress(address: string): string {
  const normalized = address.toLowerCase();
  const nonce = crypto.randomBytes(16).toString('hex');
  nonceMap.set(normalized, {
    nonce,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
  });
  return nonce;
}

export function validateAndConsumeNonce(address: string, clientNonce?: string): boolean {
  const normalized = address.toLowerCase();
  const stored = nonceMap.get(normalized);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    nonceMap.delete(normalized);
    return false;
  }
  // Invalidate after use
  nonceMap.delete(normalized);
  return true;
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
