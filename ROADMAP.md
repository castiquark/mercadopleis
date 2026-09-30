# mercadopleis — Roadmap de Producto y Arquitectura

**Documento:** Roadmap Técnico y Estratégico Integrado (Post-MVP)  
**Versión:** 2.0  
**Estado:** Activo / En Ejecución  
**Documentos de Referencia:**  
* [MARKETING_LAUNCH_PLAN.md](./MARKETING_LAUNCH_PLAN.md) — Plan Estratégico de Lanzamiento, Tracción Semilla y Economía de Agentes  
* [PRODUCT_STATUS.md](./PRODUCT_STATUS.md) — Estado Actual del Producto, Contratos y Catálogo  
* [crypto_service_marketplace_product_architecture.md](./crypto_service_marketplace_product_architecture.md) — Arquitectura de Dominio y Contratos  
* [sprint_0_specification.md](./sprint_0_specification.md) — Especificación Económica y Reglas de Escrow  

---

## 📌 Estado Actual del Proyecto (Sprints 0 a 6 — Completados)

| Módulo / Sprint | Alcance Implementado | Estado |
|---|---|---|
| **Sprint 0: Diseño y Economía** | Modelo de comisión (3.0% deducido del vendedor, 0% comprador), hard cap 10%, auto-release (5 días), reglas de arbitraje | ✅ Completado |
| **Sprint 1: Catálogo y Frontend** | Catálogo digital y servicios físicos/presenciales/híbridos, filtros de ubicación geográfica, stack Next.js 15 + Tailwind | ✅ Completado |
| **Sprint 2: Identidad Web3** | Conexión multicartera con RainbowKit / Wagmi, autenticación SIWE (Sign-In with Ethereum) con fallback por wallet address | ✅ Completado |
| **Sprint 3: Smart Contract Escrow** | `MarketplaceEscrow.sol` verificado con Foundry (invariantes y fuzzing aprobados), deployed en Base Sepolia y Mainnet | ✅ Completado |
| **Sprint 4: Ciclo de Órdenes** | Dashboard `/orders`, depósito non-custodial, registro de entregas con hash SHA-256, liberación on-chain y reembolsos por timeout | ✅ Completado |
| **Sprint 5: Arbitraje & Reviews** | Panel de moderación para rol `arbitrator` (`/admin`), resolución de disputas, sistema de reseñas auténticas con estrellas (1 a 5) | ✅ Completado |
| **Sprint 6: Mainnet & Pivot IA** | Despliegue en Base Mainnet (`0x9E5b...`), USDC oficial de Circle, especificación `/llms.txt`, APIs CORS, catálogo semilla ($10–$35 USDC) | ✅ Completado |

---

## 🗺️ Fases de Evolución Estratégica

```text
[ FASE 1: Hardening & Despliegue en Base Mainnet (Dinero Real) ]  ✅ COMPLETADO
                        │
                        ▼
[ FASE 2: GTM, Tracción Semilla & Agent Economy Wedge ]           🔄 EN EJECUCIÓN (Semanas 1 a 4)
                        │
                        ▼
[ FASE 3: Request Marketplace & Presupuestos Inversos (Bounties) ] 📋 PLANIFICADO
                        │
                        ▼
[ FASE 4: Base Mini Apps & Integración con Farcaster Actions ]     📋 PLANIFICADO
                        │
                        ▼
[ FASE 5: Expansión EVM Multichain (Polygon PoS + Arbitrum One) ]  📋 PLANIFICADO
                        │
                        ▼
[ FASE 6: Milestones & Pagos Programables por Hitos ]              📋 PLANIFICADO
                        │
                        ▼
[ FASE 7: Integración del Ecosistema Solana (Anchor + Phantom) ]   📋 PLANIFICADO
```

---

### 🚀 Fase 1: Hardening, Despliegue en Base Mainnet & Agent-Readiness (Sprint 6)

**Objetivo:** Llevar `mercadopleis` de la red de pruebas a producción con dinero real en [mercadopleis.club](https://mercadopleis.club) con infraestructura lista para agentes y humanos.

* **1.1. Smart Contract en Base Mainnet (`0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48`):** ✅ Completado
  * Verificado y público en [BaseScan](https://basescan.org/address/0x9e5b4c1112f026568233dc571dd4120dbe9fbf48#code) y [Sourcify](https://sourcify.dev/server/verify-ui/jobs/2f44398c-92ad-42a5-955f-a5f60cb23cfb).
  * Parámetros: 3% fee vendedor, 0% recargo comprador, árbitro `0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00`.
* **1.2. Integración de USDC Oficial de Circle:** ✅ Completado
  * Token: [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) (USDC nativo en Base, 6 decimales).
* **1.3. Frontend en Producción:** ✅ Completado
  * Despliegue continuo en Netlify Edge, soporte bilingüe (ES/EN), Google Analytics integrado (`G-2GCQ3QTT5D`), viewport móvil optimizado.
* **1.4. Agent-Readiness & Interoperabilidad:** ✅ Completado
  * Especificación estándar [`/llms.txt`](./apps/web/public/llms.txt) para LLMs y agentes autónomos.
  * APIs `/api/services` y `/api/services/[slug]` con metadatos de contrato y soporte CORS completo (`*`).
* **1.5. Oferta Semilla Especializada en la Economía de IA:** ✅ Completado
  * 5 micro-servicios accesibles ($10 a $35 USDC) en PostgreSQL Neon (transcripción de audio, limpieza de datasets JSONL, flujos n8n, red-teaming de prompts, scraping en Python).

---

### 🎯 Fase 2: GTM, Tracción Semilla & Agent Economy Wedge (Semanas 1 a 4)

**Objetivo:** Obtener las primeras 10 a 20 transacciones reales y sembrar liquidez crítica en el nicho vertical de **"Servicios para la Economía de IA"** mediante distribución de nicho y el posicionamiento de agentes de IA, según lo especificado en [`MARKETING_LAUNCH_PLAN.md`](./MARKETING_LAUNCH_PLAN.md).

#### 2.1. Semana 1 — Seed & Supply (Oferta Inicial)
* **Objetivo:** 20 servicios reales y 10 proveedores verificados en nichos de IA, automatizaciones y datos.
* **Canales de Difusión:**
  * **Farcaster:** Canales `/base`, `/agents`, `/build`, `/beyond-ai` presentando el contrato de escrow verified y el landing de lanzamiento.
  * **Base Ecosystem:** Listado de builders y proyectos en el ecosistema oficial de Base.
  * **X (Twitter):** Publicación técnica del anuncio y desglose del modelo (3% fee, 0% buyer, liquidación USDC instantánea).
  * **Reddit Técnico:** Comunidades `/r/ethereum`, `/r/base`, `/r/localllama`, `/r/sideproject` con enfoque en el modelo de custodia programable.
  * **Outreach Directo (1-a-1):** Contacto directo con creadores de flujos n8n/Make, prompt engineers y desarrolladores Web3.
* **Materiales Gráficos de Campaña:**
  * `hero-launch-banner.jpg` (anuncio oficial).
  * `traditional-vs-mercadopleis.jpg` (comparativa 20% vs 3%).
  * `ai-agent-delivery-cycle.jpg` (diagrama de entrega con hash SHA-256).

#### 2.2. Semana 2 — First Transactions (Primeras Transacciones Reales)
* **Objetivo:** 5 a 10 órdenes reales completadas de punta a punta en Base Mainnet.
* **Foco:** Micro-servicios de bajo monto ($10 a $50 USDC) para reducir la fricción de adopción inicial.
* **Validación de Circuito Completo:**
  1. Depósito real de USDC en el contrato de escrow.
  2. Notificación y ejecución del trabajo por el prestador.
  3. Entrega formal con registro de hash criptográfico SHA-256.
  4. Aprobación del comprador y liquidación on-chain instantánea.
  5. Emisión de las primeras reseñas verificadas en producción.

#### 2.3. Semana 3 — Build in Public & Credibilidad Técnica
* **Objetivo:** Convertir la tracción inicial en prueba social para atraer compradores y proveedores orgánicos.
* **Hitos Públicos a Comunicar:**
  * Primera transacción completada on-chain con enlace a BaseScan.
  * Primer proveedor pagado y primera reseña 5 estrellas.
  * Primeros $100 USDC en volumen transaccionado.
  * Primer pedido transfronterizo liquidado en 2 segundos.
* **Contenido Técnico:**
  * Artículos sobre la arquitectura del escrow, auto-release de 5 días e invariantes matemáticas comprobadas en Foundry.

#### 2.4. Semana 4 — Agent Wedge & Servidor MCP
* **Objetivo:** Permitir que agentes autónomos de IA descubran, coticen y subcontraten servicios directamente vía software.
* **Entregables:**
  * Paquete oficial `@mercadopleis/mcp-server` (Model Context Protocol) para conectar Claude Desktop, Cursor y agentes compatibles.
  * Herramientas MCP expuestas: `search_services`, `get_service_quote`, `inspect_escrow_order`.
  * Integración con frameworks de agentes (Mastra, LangChain, CrewAI).
  * Narrativa de consolidación: *"Conecta tu agente a Mercadopleis y permítele subcontratar trabajo humano verificado"*.

#### 2.5. Métricas de Éxito de la Fase 2:
| Métrica | Meta Inicial |
|---|---:|
| Servicios publicados activos | 20+ |
| Proveedores únicos activos | 10+ |
| Wallets compradoras únicas | 10+ |
| Órdenes reales completadas on-chain | 10+ |
| Reseñas verificadas | 5+ |
| Repeat buyers | 2+ |
| Volumen total transaccionado | $200 – $500 USDC |
| Tasa de conversión de servicios (≥1 venta) | >30% |

---

### 📋 Fase 3: Request Marketplace & Presupuestos Inversos (Bounties)

**Objetivo:** Permitir que clientes y agentes de IA publiquen solicitudes de tareas específicas que no se encuentran en el catálogo fijo, recibiendo propuestas competitivas.

* **3.1. Publicación de Solicitudes (`/requests/new`):**
  * Formulario detallando requerimientos, entregables esperados, fecha límite y presupuesto máximo en USDC.
  * Clasificación por categorías de IA (`ai_data`, `development`, `writing_translation`, etc.).
* **3.2. Postulación de Prestadores:**
  * Sistema de propuestas técnicas con cotización personalizada y plazo propuesto.
* **3.3. Adjudicación y Depósito Directo en Escrow:**
  * Con un clic, el cliente acepta la cotización y deposita los fondos en el smart contract bajo los términos acordados.

---

### 📱 Fase 4: Ecosistema Base Mini Apps & Farcaster Actions

**Objetivo:** Distribuir el marketplace directamente dentro del flujo nativo de usuarios de Base y redes sociales descentralizadas.

* **4.1. Mini App Oficial de Base:**
  * Adaptación del frontend con `@coinbase/minikit` para su publicación en Coinbase Wallet y el ecosistema oficial de Mini Apps de Base.
  * Experiencia de checkout en 1-tap sin salir del feed de la billetera.
* **4.2. Farcaster Actions & Frames v2:**
  * Contratación directa de micro-servicios mediante Frames interactivos dentro de Warpcast.
  * Notificaciones de entrega y aprobación en el cliente social.

---

### 🌐 Fase 5: Expansión EVM Multichain (Polygon PoS + Arbitrum One)

**Objetivo:** Expandir el protocolo a redes con base de usuarios complementaria una vez consolidada la liquidez en Base.

* **5.1. Despliegue en Polygon PoS (Chain ID: 137):**
  * Smart contract `MarketplaceEscrow.sol` + Native USDC Polygon (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`).
  * Enfoque: Micropagos y acceso directo desde exchanges y rampas locales en Latinoamérica.
* **5.2. Despliegue en Arbitrum One (Chain ID: 42161):**
  * Smart contract `MarketplaceEscrow.sol` + Native USDC Arbitrum (`0xaf88d065e77c4cCD5439455e4429FDaf4360c049`).
  * Enfoque: Ecosistema DeFi y desarrolladores Web3 globales.
* **5.3. Selector de Red Multichain en Frontend:**
  * Selector dinámico en checkout para pagar en Base, Polygon o Arbitrum según conveniencia de gas y liquidez del comprador.

---

### 🎯 Fase 6: Milestones y Pagos Programables por Hitos

**Objetivo:** Habilitar proyectos técnicos de mediana y gran escala ($500 a $10,000+ USDC) con custodia fraccionada y liberaciones por entregables intermedios.

* **6.1. Smart Contract de Hitos (`MarketplaceMilestoneEscrow.sol`):**
  * Depósito único del presupuesto total al inicio del contrato.
  * División en $N$ entregables progresivos (ej. 30% diseño / 40% desarrollo / 30% testing).
  * Hash criptográfico y ventana de 5 días independiente por cada hito.
* **6.2. UI de Aprobación Progresiva:**
  * Liberación parcial de fondos hito por hito sin cancelar el resto de la orden.
  * Disputas granulares aisladas exclusivamente al hito en conflicto.

---

### ⚡ Fase 7: Integración del Ecosistema Solana

**Objetivo:** Capturar el mercado masivo de usuarios de wallets Phantom/Solflare con liquidaciones sub-segundo y micro-tarifas de red.

* **7.1. Programa Escrow en Rust / Anchor:**
  * Desarrollo del programa equivalente en el runtime de Solana con SPL-USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).
* **7.2. Frontend Dual (EVM + Solana):**
  * Integración de `@solana/wallet-adapter-react` junto con RainbowKit/Wagmi.
* **7.3. Autenticación SIWS (Sign-In with Solana):**
  * Sesiones criptográficas con direcciones Base58.

---

## 📈 Resumen de Parámetros Económicos Clave

* **Comisión de Protocolo:** 3.0% (300 basis points) deducido del cobro del vendedor al liberarse los fondos.
* **Recargo al Comprador:** 0.0% (el comprador paga exactamente el precio listado en USDC).
* **Costos de Red (Gas):** ~<$0.01 USD por transacción en Base L2.
* **Ventana de Inspección:** 5 días garantizados tras la entrega antes de auto-release.
* **Liquidación:** 100% Non-Custodial, directamente a la wallet del prestador.
