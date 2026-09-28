import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = 'http://localhost:3000/api';
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;

async function authenticateWallet(account: any) {
  const nonceRes = await fetch(`${API_BASE}/auth/nonce?address=${account.address}`);
  if (!nonceRes.ok) throw new Error(`Failed to get nonce for ${account.address}`);
  const { nonce } = await nonceRes.json();

  const domain = 'localhost:3000';
  const origin = 'http://localhost:3000';
  const statement = 'Iniciar sesión en mercadopleis con tu wallet criptográfica.';
  const issuedAt = new Date().toISOString();
  const message = `${domain} wants you to sign in with your Ethereum account:\n${account.address}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: 84532\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

  const signature = await account.signMessage({ message });

  const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: account.address,
      signature,
      message,
    }),
  });

  if (!verifyRes.ok) {
    const errText = await verifyRes.text();
    throw new Error(`SIWE verify failed for ${account.address}: ${errText}`);
  }

  const data = await verifyRes.json();
  return { token: data.token, user: data.user };
}

async function runTest() {
  console.log('========================================================================');
  console.log('🛡️  MERCADOPLEIS — VERIFICACIÓN AUTOMATIZADA DE RBAC Y MULTI-WALLET');
  console.log('========================================================================\n');

  // 1. Visitante no autenticado
  console.log('--- 1. Pruebas sin autenticación (Visitante anónimo) ---');
  const anonDisputes = await fetch(`${API_BASE}/disputes`);
  console.log(`  [Anon] GET /api/disputes -> HTTP ${anonDisputes.status} (Esperado: 401 Unauthorized)`);
  if (anonDisputes.status !== 401) throw new Error('Security flaw: anonymous access allowed to disputes');

  const anonOrders = await fetch(`${API_BASE}/orders/my`);
  console.log(`  [Anon] GET /api/orders/my -> HTTP ${anonOrders.status} (Esperado: 401 Unauthorized)`);
  if (anonOrders.status !== 401) throw new Error('Security flaw: anonymous access allowed to orders/my');

  // 2. Wallet Comprador (Usuario Regular 1)
  console.log('\n--- 2. Pruebas con Wallet de Comprador (Usuario Regular A) ---');
  const buyerAccount = privateKeyToAccount(generatePrivateKey());
  console.log(`  Wallet A: ${buyerAccount.address}`);
  const buyerAuth = await authenticateWallet(buyerAccount);
  console.log(`  ✓ SIWE exitoso. Rol asignado: "${buyerAuth.user.role}" (Esperado: "USER")`);
  if (buyerAuth.user.role !== 'USER') throw new Error('Security flaw: user wallet assigned non-user role');

  const buyerDisputes = await fetch(`${API_BASE}/disputes`, {
    headers: { Authorization: `Bearer ${buyerAuth.token}` },
  });
  console.log(`  [Buyer] GET /api/disputes -> HTTP ${buyerDisputes.status} (Esperado: 403 Forbidden)`);
  const buyerDisputesJson = await buyerDisputes.json();
  console.log(`  Mensaje de respuesta: "${buyerDisputesJson.error}"`);
  if (buyerDisputes.status !== 403) throw new Error('Security flaw: regular user can access disputes');

  const buyerResolve = await fetch(`${API_BASE}/disputes/disp-random-id/resolve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${buyerAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sellerAwardUsdc: 10, buyerRefundUsdc: 10 }),
  });
  console.log(`  [Buyer] POST /api/disputes/.../resolve -> HTTP ${buyerResolve.status} (Esperado: 403 Forbidden)`);
  if (buyerResolve.status !== 403) throw new Error('Security flaw: regular user can resolve disputes');

  const buyerOrders = await fetch(`${API_BASE}/orders/my`, {
    headers: { Authorization: `Bearer ${buyerAuth.token}` },
  });
  const buyerOrdersData = await buyerOrders.json();
  console.log(`  [Buyer] GET /api/orders/my -> HTTP ${buyerOrders.status} (Órdenes devueltas: ${buyerOrdersData.orders?.length || 0})`);

  // 3. Wallet Prestador (Usuario Regular 2)
  console.log('\n--- 3. Pruebas con Wallet de Prestador (Usuario Regular B) ---');
  const sellerAccount = privateKeyToAccount(generatePrivateKey());
  console.log(`  Wallet B: ${sellerAccount.address}`);
  const sellerAuth = await authenticateWallet(sellerAccount);
  console.log(`  ✓ SIWE exitoso. Rol asignado: "${sellerAuth.user.role}" (Esperado: "USER")`);
  if (sellerAuth.user.role !== 'USER') throw new Error('Security flaw: user wallet assigned non-user role');

  const sellerDisputes = await fetch(`${API_BASE}/disputes`, {
    headers: { Authorization: `Bearer ${sellerAuth.token}` },
  });
  console.log(`  [Seller] GET /api/disputes -> HTTP ${sellerDisputes.status} (Esperado: 403 Forbidden)`);
  if (sellerDisputes.status !== 403) throw new Error('Security flaw: regular seller can access disputes');

  // 4. Wallet Administrador Oficial (la que cobra los fees)
  console.log('\n--- 4. Pruebas con Wallet Administradora (0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00) ---');
  const adminAccount = privateKeyToAccount(DEPLOYER_KEY);
  console.log(`  Wallet Admin: ${adminAccount.address}`);
  const adminAuth = await authenticateWallet(adminAccount);
  console.log(`  ✓ SIWE exitoso. Rol asignado: "${adminAuth.user.role}" (Esperado: "ADMIN")`);
  if (adminAuth.user.role !== 'ADMIN') throw new Error('Security flaw: admin wallet was not granted ADMIN role');

  const adminDisputes = await fetch(`${API_BASE}/disputes`, {
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  console.log(`  [Admin] GET /api/disputes -> HTTP ${adminDisputes.status} (Esperado: 200 OK)`);
  const adminDisputesData = await adminDisputes.json();
  console.log(`  Disputas accesibles para el Administrador: ${adminDisputesData.disputes?.length ?? 0}`);
  if (adminDisputes.status !== 200) throw new Error('Admin should have access to disputes');

  console.log('\n========================================================================');
  console.log('✅ TODAS LAS PRUEBAS DE SEGURIDAD Y AISLAMIENTO DE WALLETS PASARON AL 100%');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS RBAC:', err);
  process.exit(1);
});
