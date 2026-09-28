# mercadopleis — Roadmap de Producto y Arquitectura

**Documento:** Roadmap Técnico y Estratégico Post-MVP  
**Versión:** 1.0  
**Estado:** Activo  
**Documentos de Referencia:**  
* [crypto_service_marketplace_product_architecture.md](./crypto_service_marketplace_product_architecture.md)
* [sprint_0_specification.md](./sprint_0_specification.md)

---

## 📌 Estado Actual del Proyecto (Sprints 0 a 5 — Completados)

| Módulo / Sprint | Alcance Implementado | Estado |
|---|---|---|
| **Sprint 0: Diseño y Economía** | Modelo de comisión (3.0% deducido del vendedor), hard cap 10%, tiempos de auto-release (5 días), reglas de disputa | ✅ Completado |
| **Sprint 1: Catálogo y Frontend** | Catálogo digital y servicios físicos/presenciales/híbridos, filtros de ubicación geográfica (país, ciudad, barrio/balneario), stack Next.js 15 + Tailwind | ✅ Completado |
| **Sprint 2: Identidad Web3** | Conexión multicartera con RainbowKit / Wagmi, autenticación SIWE (Sign-In with Ethereum) con fallback resiliente por dirección pública de wallet | ✅ Completado |
| **Sprint 3: Smart Contract Escrow** | `MarketplaceEscrow.sol` verificado con Foundry (invariantes financieras y fuzzing 100% aprobadas), desplegado en Base Sepolia (`0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48`), soporte para tokens ERC-20 (USDC) | ✅ Completado |
| **Sprint 4: Ciclo de Órdenes** | Dashboard `/orders`, depósito non-custodial, registro de entregas con hash SHA-256 en Neon Object Storage, liberación on-chain y reembolsos por timeout | ✅ Completado |
| **Sprint 5: Arbitraje & Reviews** | Panel de moderación y arbitraje para rol `arbitrator` (`/admin`), resolución de disputas con división flexible, sistema completo de reseñas y calificaciones con estrellas (1 a 5) y promedio dinámico | ✅ Completado |

---

## 🗺️ Fases de Evolución (Post-MVP)

```text
[ HOY: MVP Completo y Verificado ]
        │
        ▼
[ FASE 1: Hardening & Despliegue en Base Mainnet (Dinero Real) ]
        │
        ▼
[ FASE 2: Expansión EVM Multichain (Polygon PoS + Arbitrum One) ]
        │
        ▼
[ FASE 3: Request Marketplace & Presupuestos Inversos ]
        │
        ▼
[ FASE 4: Milestones & Pagos Programables por Hitos ]
        │
        ▼
[ FASE 5: Integración del Ecosistema Solana (Anchor + Phantom) ]
```

---

### 🚀 Fase 1: Hardening & Despliegue en Base Mainnet (Sprint 6)

**Objetivo:** Llevar `mercadopleis` de la red de pruebas (Base Sepolia) a producción con dinero real en [mercadopleis.club](https://mercadopleis.club).

* **1.1. Script de Despliegue en Foundry (`contracts/script/DeployMainnet.s.sol`):** ✅ Completado
  * Despliegue del smart contract `MarketplaceEscrow.sol` en **Base Mainnet** (Chain ID: `8453`).
  * Dirección del Contrato en Mainnet: [`0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48`](https://basescan.org/address/0x9e5b4c1112f026568233dc571dd4120dbe9fbf48)
  * Tx de Despliegue: `0xc5513a6927977c46ccbef8df2082dd87121b26cd6cba96579a41203954953412`
  * Parámetros inmutables:
    * `feeRecipient`: `0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00`
    * `arbitrator`: `0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00`
    * `initialFeeBps`: `300` (3.0%)
* **1.2. Habilitación de USDC Oficial de Circle:** ✅ Completado
  * Tx de Habilitación: `0x07d81f80f1aa60ef65886ea89058ed1bccab8e7c4fce67ad16bcb7f0fa30eac4`
  * Token: [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) (USDC oficial nativo de Circle en Base, 6 decimales).
* **1.3. Verificación de Código Fuente en BaseScan:** ✅ Completado
  * Verificado y público en [BaseScan](https://basescan.org/address/0x9e5b4c1112f026568233dc571dd4120dbe9fbf48#code) y [Sourcify](https://sourcify.dev/server/verify-ui/jobs/2f44398c-92ad-42a5-955f-a5f60cb23cfb).
* **1.4. Configuración de Entorno en Frontend:** ✅ Completado
  * Contrato configurado en `ESCROW_ADDRESSES[8453]` en `@mercadopleis/contracts-abi`.
  * Cadena principal por defecto en RainbowKit / Wagmi establecida en `base` (Base Mainnet).
  * USDC oficial vinculado automáticamente al operar en Base Mainnet.
* **1.5. Ajustes de Navegación:**
  * Desactivar o condicionar el enlace `/faucet` únicamente para entornos de prueba.
* **1.6. Smoke Test con Dinero Real:**
  * Contratación real de prueba por $1.00 USDC verificando recepción de $0.97 por el prestador y $0.03 de fee de plataforma.

---

### 🌐 Fase 2: Expansión EVM Multichain Inmediata

**Objetivo:** Permitir pagos y cobros en las Layer 2 más populares sin necesidad de reescribir contratos inteligentes.

* **2.1. Despliegue en Polygon PoS (Chain ID: 137):**
  * Despliegue de `MarketplaceEscrow.sol`.
  * Token: Native USDC en Polygon (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`).
  * Enfoque: Micropagos y usuarios de exchanges locales en Latinoamérica (MercadoPago, Lemon, Ripio, Binance).
* **2.2. Despliegue en Arbitrum One (Chain ID: 42161):**
  * Despliegue de `MarketplaceEscrow.sol`.
  * Token: Native USDC en Arbitrum (`0xaf88d065e77c4cCD5439455e4429FDaf4360c049`).
  * Enfoque: Ecosistema DeFi y desarrolladores Web3 globales.
* **2.3. Selector de Red Multichain en Frontend:**
  * Actualización de Wagmi/RainbowKit para soportar Base, Polygon y Arbitrum de forma concurrente.
  * Selector de red en el modal de checkout para que el comprador pague en la red de su preferencia.
  * Etiqueta de redes aceptadas en las publicaciones de servicio.

---

### 📋 Fase 3: Request Marketplace & Presupuestos (Marketplace Inverso)

**Objetivo:** Transformar mercadopleis de un catálogo de servicios fijo a un modelo bidireccional donde los clientes publican sus requerimientos.

* **3.1. Publicación de Pedidos por Clientes (`/requests/new`):**
  * Formulario para que el cliente detalle qué servicio busca, fecha límite requerida y presupuesto estimado en USDC.
  * Categorización y modalidad (Remoto o Presencial con ubicación).
* **3.2. Envío de Propuestas Técnicas y Económicas:**
  * Los prestadores pueden postularse y enviar cotizaciones con plazo propuesto y precio final.
* **3.3. Aceptación y Creación de Escrow Directo:**
  * Con un clic, el cliente acepta una propuesta y se abre el flujo de depósito de fondos en el smart contract bajo el precio acordado.

---

### 🎯 Fase 4: Milestones y Pagos Programables por Hitos

**Objetivo:** Permitir contratos de mayor envergadura ($500 a $10,000+ USDC) con liberaciones progresivas contra entregables intermedios.

* **4.1. Smart Contract de Hitos (`MarketplaceMilestoneEscrow.sol`):**
  * Depósito del total del presupuesto al inicio.
  * Desglose en $N$ hitos (ej. Hito 1: 30%, Hito 2: 40%, Hito 3: 30%).
  * Cada hito cuenta con su propio hash de entrega y ventana independiente de revisión.
* **4.2. UI de Aprobación Progresiva:**
  * Panel visual donde el cliente aprueba hito por hito, liberando los fondos correspondientes sin cancelar el resto del contrato.
  * Disputa granular (posibilidad de disputar solo el hito en conflicto).

---

### ⚡ Fase 5: Integración del Ecosistema Solana

**Objetivo:** Capturar el mercado retail masivo de usuarios de wallets Phantom/Solflare con liquidaciones sub-segundo y costos inferiores a $0.001 USD.

* **5.1. Programa Escrow en Rust / Anchor:**
  * Desarrollo del programa de custodia equivalente en el runtime de Solana.
  * Uso de SPL-USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).
* **5.2. Frontend Dual (EVM + Solana):**
  * Integración de `@solana/wallet-adapter-react` junto con RainbowKit.
  * Detección automática de tipo de wallet conectada.
* **5.3. Autenticación SIWS (Sign-In with Solana):**
  * Generación de sesiones criptográficas compatibles con direcciones base58 de Solana.

---

## 📈 Resumen Financiero y Métricas Clave

* **Take Rate Base:** 3.0% (300 bps) sobre el monto bruto del prestador.
* **Costos Operativos de Red:** Cubiertos por los usuarios (~$0.01 USD por transacción en Base L2).
* **Costo de Entrada a Mainnet:** ~$5 a $10 USD en ETH de Base para despliegue y reserva de gas.
* **Infraestructura:** 100% Serverless y Non-Custodial (Netlify + Neon PostgreSQL + Base Smart Contracts).
