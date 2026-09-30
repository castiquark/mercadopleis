import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { db, users } from '@mercadopleis/database';
import { eq } from 'drizzle-orm';
import { validateAndConsumeNonce, signUserToken } from '@/lib/serverAuth';

interface ParsedSiweMessage {
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

function parseSiweMessage(message: string): ParsedSiweMessage | null {
  try {
    const headerMatch = message.match(/^([^\n]+) wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})/);
    if (!headerMatch) return null;

    const domain = headerMatch[1].trim();
    const address = headerMatch[2].trim();

    const uriMatch = message.match(/\nURI:\s*([^\n]+)/);
    const versionMatch = message.match(/\nVersion:\s*([^\n]+)/);
    const chainIdMatch = message.match(/\nChain ID:\s*([^\n]+)/);
    const nonceMatch = message.match(/\nNonce:\s*([^\n]+)/);
    const issuedAtMatch = message.match(/\nIssued At:\s*([^\n]+)/);
    const expirationMatch = message.match(/\nExpiration Time:\s*([^\n]+)/);

    if (!uriMatch || !versionMatch || !chainIdMatch || !nonceMatch || !issuedAtMatch) {
      return null;
    }

    return {
      domain,
      address,
      uri: uriMatch[1].trim(),
      version: versionMatch[1].trim(),
      chainId: parseInt(chainIdMatch[1].trim(), 10),
      nonce: nonceMatch[1].trim(),
      issuedAt: issuedAtMatch[1].trim(),
      expirationTime: expirationMatch ? expirationMatch[1].trim() : undefined,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
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

    // Validate version (EIP-4361 requires version === '1')
    if (parsed.version !== '1') {
      return NextResponse.json(
        { error: `Unsupported SIWE version: ${parsed.version}. Expected version 1.` },
        { status: 400 }
      );
    }

    // Validate domain
    const reqHost = (
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      ''
    ).toLowerCase().trim();
    const reqHostWithoutPort = reqHost.split(':')[0];
    const parsedDomain = parsed.domain.toLowerCase().trim();
    const parsedDomainWithoutPort = parsedDomain.split(':')[0];

    const allowedDomains = [
      'mercadopleis.club',
      'www.mercadopleis.club',
      'localhost',
      '127.0.0.1',
    ];

    const isDomainAllowed =
      parsedDomain === reqHost ||
      parsedDomainWithoutPort === reqHostWithoutPort ||
      allowedDomains.includes(parsedDomainWithoutPort);

    if (!isDomainAllowed) {
      return NextResponse.json(
        { error: `Invalid SIWE domain: ${parsed.domain}. Expected Mercadopleis domain or active host.` },
        { status: 400 }
      );
    }

    // Validate URI authority matches domain
    let parsedUri: URL;
    try {
      parsedUri = new URL(parsed.uri);
    } catch {
      return NextResponse.json(
        { error: `Invalid SIWE URI: ${parsed.uri}. Must be a valid URI.` },
        { status: 400 }
      );
    }

    if (parsedUri.host.toLowerCase() !== parsedDomain) {
      return NextResponse.json(
        { error: `SIWE URI authority (${parsedUri.host}) does not match domain (${parsed.domain})` },
        { status: 400 }
      );
    }

    // Validate chainId (Base Mainnet 8453 or Base Sepolia 84532)
    if (parsed.chainId !== 8453 && parsed.chainId !== 84532) {
      return NextResponse.json(
        { error: `Unsupported SIWE chainId: ${parsed.chainId}. Expected 8453 or 84532.` },
        { status: 400 }
      );
    }

    // Validate timestamp (not in future by >60s, not older than 10m)
    const issuedAtMs = Date.parse(parsed.issuedAt);
    if (isNaN(issuedAtMs)) {
      return NextResponse.json({ error: 'Invalid SIWE issuedAt timestamp' }, { status: 400 });
    }
    const now = Date.now();
    if (issuedAtMs > now + 60 * 1000) {
      return NextResponse.json({ error: 'SIWE message issuedAt timestamp is in the future' }, { status: 400 });
    }
    if (now - issuedAtMs > 10 * 60 * 1000) {
      return NextResponse.json({ error: 'SIWE message has expired (>10 minutes old)' }, { status: 400 });
    }

    // 2. Validate & atomically consume durable nonce from PostgreSQL
    const nonceResult = await validateAndConsumeNonce(normalized, parsed.nonce);
    if (!nonceResult.isValid) {
      return NextResponse.json(
        { error: nonceResult.error || 'Nonce expired or invalid. Request a new challenge nonce.' },
        { status: 400 }
      );
    }

    // 3. Cryptographic signature verification
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
