import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { verifyMessage } from 'viem';
import { db, users } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { config } from '../config';

export const authRouter = Router();

// In-memory or temporary nonce map (can also be saved to DB)
const nonces = new Map<string, { nonce: string; expiresAt: number }>();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
    role: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      walletAddress: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

/**
 * Generates a challenge nonce for a wallet address
 */
authRouter.get('/nonce', (req: Request, res: Response) => {
  const address = (req.query.address as string)?.toLowerCase();
  if (!address || !address.startsWith('0x')) {
    return res.status(400).json({ error: 'Valid wallet address required' });
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  nonces.set(address, {
    nonce,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  return res.json({ nonce });
});

/**
 * Verifies cryptographic wallet signature and issues session JWT
 */
authRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const { address, signature, message } = req.body;
    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const normalizedAddress = address.toLowerCase();
    const stored = nonces.get(normalizedAddress);

    if (!stored || Date.now() > stored.expiresAt) {
      return res.status(400).json({ error: 'Nonce expired or not found. Request a new nonce.' });
    }

    // Verify SIWE signature using Viem
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid cryptographic signature' });
    }

    // Invalidate used nonce
    nonces.delete(normalizedAddress);

    // Upsert user in database
    const existingUser = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalizedAddress),
    });

    let userId: string;
    let userRole = 'USER';

    if (!existingUser) {
      const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const randomSuffix = Math.floor(Math.random() * 10000);
      const username = `user_${address.slice(2, 8)}_${randomSuffix}`;

      const [newUser] = await db
        .insert(users)
        .values({
          walletAddress: normalizedAddress,
          username,
          displayName: shortAddr,
          role: 'USER',
        })
        .returning();

      userId = newUser.id;
    } else {
      userId = existingUser.id;
      userRole = existingUser.role;
    }

    // Issue JWT
    const token = jwt.sign(
      {
        id: userId,
        walletAddress: normalizedAddress,
        role: userRole,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: userId,
        walletAddress: normalizedAddress,
        role: userRole,
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/verify:', error);
    return res.status(500).json({ error: 'Internal server error during verification' });
  }
});

/**
 * Returns current authenticated profile
 */
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});
