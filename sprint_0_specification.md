# mercadopleis — Especificación Técnica & Reglas de Negocio (Sprint 0)

**Documento:** Sprint 0 Definitive Specification  
**Estado:** Aprobado para Desarrollo  
**Identificador del Proyecto:** `mercadopleis`  
**Red Objetivo:** Base (Testnet: Base Sepolia)  
**Moneda de Pago:** USDC (ERC-20)  

---

## 1. Reglas Económicas y Modelo de Comisión

| Parámetro | Valor Definido | Descripción |
|---|---|---|
| **Estructura del Fee** | Deducido del prestador (*Seller fee*) | El comprador paga exactamente el precio listado (cero fricción en checkout). La plataforma descuenta la comisión al momento de liquidar los fondos al prestador. |
| **Comisión Inicial** | **3.0%** (300 bps) | Cubre costos de RPC, indexación y servidores, dejando margen neto por transacción. |
| **Tope Máximo en Contrato** | **10.0%** (1000 bps) | Hard cap inmutable programado en el smart contract para dar garantías criptográficas a los vendedores. |
| **Moneda** | USDC | Transferencias seguras mediante `SafeERC20`. |

### Fórmulas Financieras
- **En liberación exitosa (`releaseFunds`):**
  $$\text{grossAmount} = \text{precio\_servicio}$$
  $$\text{platformFee} = \frac{\text{grossAmount} \times \text{feeBps}}{10000}$$
  $$\text{sellerPayout} = \text{grossAmount} - \text{platformFee}$$

- **En reembolso al comprador (`refundOrder` / `claimTimeoutRefund`):**
  $$\text{buyerRefund} = \text{grossAmount} \quad (100\%)$$
  $$\text{platformFee} = 0$$

- **En resolución de disputa (`resolveDispute`):**
  $$\text{sellerAmount} + \text{buyerRefund} = \text{grossAmount}$$
  $$\text{platformFee} = \frac{\text{sellerAmount} \times \text{feeBps}}{10000}$$
  $$\text{sellerPayout} = \text{sellerAmount} - \text{platformFee}$$

---

## 2. Plazos y Reglas de Tiempo (Timeouts)

1. **Auto-release por falta de respuesta del comprador:**
   - **Plazo:** **5 días naturales (120 horas)** tras el registro de entrega (`submitDelivery`).
   - Si el comprador no aprueba ni abre disputa dentro de este plazo, cualquier participante o el prestador puede ejecutar `claimAutoRelease(orderId)`.

2. **Incumplimiento del plazo de entrega por el vendedor:**
   - Si `block.timestamp > deadline` y el vendedor no ha ejecutado `submitDelivery`, el comprador puede ejecutar **`claimTimeoutRefund(orderId)`** y recuperar el 100% de sus USDC automáticamente, sin intermediarios ni disputas.

---

## 3. Modelo de Disputas y Arbitraje

- **Rol en el Contrato:** Cuenta autorizada (`arbitrator`) designada por la plataforma (multisig / wallet operativa).
- **Mecanismo:** División flexible (`resolveDispute(orderId, sellerAmount, buyerRefund)`).
- **Regla de Fee en Disputa:** La plataforma aplica el 3% de comisión **únicamente sobre el monto asignado al prestador**. Si se reembolsa el 100% al comprador, la plataforma no cobra comisión.

---

## 4. Smart Contract (`MarketplaceEscrow.sol`)

- **Entorno de Desarrollo & Testing:** **Foundry** (tests unitarios, fuzzing e invariantes en Solidity).
- **Alcance MVP:** **Orden de hito único (Single Deliverable / Fixed Price)**.
- **Invariante Crítica:**
  $$\text{released} + \text{refunded} = \text{funded}$$
  *(Los fondos nunca pueden quedar atrapados ni ser transferidos más de una vez).*

### Máquina de Estados

```text
        [ CREATED ]
             │ (fundOrder)
             ▼
         [ FUNDED ] ───(claimTimeoutRefund si vence deadline)───► [ REFUNDED ]
             │
             │ (submitDelivery con deliveryHash)
             ▼
        [ DELIVERED ]
        ┌────┴─────────────────────────────┐
        │                                  │ (openDispute)
        │ (approveDelivery / auto-release) ▼
        ▼                             [ DISPUTED ]
   [ RELEASED ]                            │ (resolveDispute)
                                           ▼
                                      [ RESOLVED ]
```

---

## 5. Stack Tecnológico y Arquitectura de Software

### Estructura: Monorepo Modular (Turborepo + pnpm)
```text
mercadopleis/
├── apps/
│   ├── web/               # Next.js (App Router, Tailwind CSS, RainbowKit, Wagmi, Viem)
│   └── api/               # Node.js / Express (Auth SIWE, API REST, Event Indexer de Base)
├── contracts/             # Foundry (MarketplaceEscrow.sol, tests, scripts de deploy)
├── packages/
│   ├── types/             # Tipos TypeScript compartidos (Order, User, Service, etc.)
│   ├── contracts-abi/     # ABIs y direcciones de contratos generados tras compilación
│   └── database/          # Esquema Drizzle ORM + migraciones PostgreSQL
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

- **Base de Datos & ORM:** PostgreSQL + **Drizzle ORM** (tipado estricto, ultra rápido, migraciones limpias).
- **Web3 Frontend & Auth:** **RainbowKit + Wagmi / Viem**, con autenticación criptográfica **SIWE (Sign-In with Ethereum, EIP-4361)** vía nonces.
- **Storage de Entregables:** Almacenamiento compatible con **S3 (Cloudflare R2 / AWS S3 / Supabase Storage)** con URLs privadas prefirmadas y registro del hash de integridad (`bytes32 deliveryHash`) on-chain.

---

## 6. Catálogo Inicial del Marketplace (4 Categorías)

1. **Desarrollo & Smart Contracts** (Websites, DApps, Solidity, APIs, Backend).
2. **Diseño UI/UX & Creativo** (Figma, landing pages, logos, branding Web3).
3. **Marketing & Redacción** (Contenido técnico, traducción, community management, SEO).
4. **Consultoría & Asesoría Web3** (Tokenomics, arquitectura técnica, auditoría preliminar).
