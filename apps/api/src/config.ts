import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'mercadopleis_development_jwt_secret_key_123',
  siweDomain: process.env.SIWE_DOMAIN || 'localhost:3000',
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  escrowAddress: (process.env.MARKETPLACE_ESCROW_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  chainId: 84532, // Base Sepolia
};
