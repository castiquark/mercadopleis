import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('JWT_SECRET must be set (min 32 chars) in production');
  }
  return secret || 'dev-only-insecure-jwt-secret-do-not-use-in-production';
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: resolveJwtSecret(),
  siweDomain: process.env.SIWE_DOMAIN || 'localhost:3000',
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  escrowAddress: (process.env.MARKETPLACE_ESCROW_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  chainId: 84532, // Base Sepolia
};
