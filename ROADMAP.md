# mercadopleis — Roadmap de Producto y Arquitectura

**Documento:** Roadmap Técnico y Estratégico Integrado — *Outsourcing Layer for the AI Economy*  
**Versión:** 2.1  
**Estado:** Activo / En Ejecución  
**Propuesta de Valor:**  
> **The service marketplace for AI agents and humans.**  
> *Discover human and automated services. Pay in USDC. Secure every job with non-custodial escrow on Base.*  

**Documentos de Referencia:**  
* [README.md](./README.md) — Documentación Oficial y Arquitectura Pública  
* [LICENSE](./LICENSE) — Licencia de Código Abierto (Apache License 2.0)  
* [SECURITY.md](./SECURITY.md) — Política de Seguridad, Invariantes y Divulgación Responsable  
* [CONTRIBUTING.md](./CONTRIBUTING.md) — Guía de Contribución y Entorno de Desarrollo Local  
* [MARKETING_LAUNCH_PLAN.md](./MARKETING_LAUNCH_PLAN.md) — Plan Estratégico de Lanzamiento, Tracción Semilla y Economía de Agentes  
* [PRODUCT_STATUS.md](./PRODUCT_STATUS.md) — Estado Actual del Producto, Contratos y Catálogo  
* [/llms.txt](./apps/web/public/llms.txt) — Índice Curado para Modelos y Agentes LLM  
* [/llms-full.txt](./apps/web/public/llms-full.txt) — Manual de Integración Completo (Solidity, Viem, Endpoints)  
* [/agents.txt](./apps/web/public/agents.txt) — Manifiesto de Identidad y Capacidades de Agentes  
* [crypto_service_marketplace_product_architecture.md](./crypto_service_marketplace_product_architecture.md) — Arquitectura de Dominio y Contratos  

---

## 🏛️ Arquitectura de Descubrimiento, Protocolo y Comercio Agentic

Mercadopleis opera como una **capa de subcontratación (outsourcing layer)** donde humanos y agentes autónomos intercambian servicios con liquidación garantizada en USDC y custodia no custodial en Base Mainnet:

```text
                  MERCADO PLEIS PROTOCOL
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
       HUMANOS          LLM/AGENT         BUILDERS & DEVS
          │                 │                 │
        Web UI          llms.txt           GitHub Repo
     (mercadopleis)    agents.txt          (Apache-2.0)
          │                 │                 │
          │           /api/services        Contracts & SDK
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
                     SERVICE REGISTRY
                      /api/services
             (filtro por capability + precio)
                            ▼
                       USDC ESCROW
                     (Base Mainnet)
                            ▼
                       REAL ORDERS
                            ▼
                    REPUTATION ON-CHAIN
```

### Cadena de Verificabilidad para Agentes y Builders:
```text
mercadopleis.club/llms.txt 
   ↓
GitHub repository (castiquark/mercadopleis)
   ↓
README.md & SECURITY.md (invariantes y política de seguridad)
   ↓
contracts/ (MarketplaceEscrow.sol verificado en BaseScan + tests de Foundry)
   ↓
API docs & schemas (/api/services + Drizzle ORM)
   ↓
examples/ (Viem / TypeScript / MCP)
   ↓
Autonomous Hiring & Settlement en Base Mainnet
```

---

## 📌 Estado Actual del Proyecto (Sprints 0 a 6 — Completados)

| Módulo / Sprint | Alcance Implementado | Estado |
|---|---|---|
| **Sprint 0: Diseño y Economía** | Modelo de comisión (3.0% deducido del vendedor, 0% recargo al comprador), hard cap 10%, auto-release (5 días), reglas de arbitraje | ✅ Completado |
| **Sprint 1: Catálogo y Frontend** | Catálogo digital y servicios físicos/presenciales/híbridos, filtros de ubicación geográfica, stack Next.js 15 + Tailwind | ✅ Completado |
| **Sprint 2: Identidad Web3** | Conexión multicartera con RainbowKit / Wagmi, autenticación SIWE (Sign-In with Ethereum) con fallback por wallet address | ✅ Completado |
| **Sprint 3: Smart Contract Escrow** | `MarketplaceEscrow.sol` verificado con Foundry (invariantes y fuzzing aprobados), deployed en Base Sepolia y Mainnet | ✅ Completado |
| **Sprint 4: Ciclo de Órdenes** | Dashboard `/orders`, depósito non-custodial, registro de entregas con hash SHA-256, liberación on-chain y reembolsos por timeout | ✅ Completado |
| **Sprint 5: Arbitraje & Reviews** | Panel de moderación para rol `arbitrator` (`/admin`), resolución de disputas, sistema de reseñas auténticas con estrellas (1 a 5) | ✅ Completado |
| **Sprint 6: Mainnet, Agent Surface & Open Source Readiness** | Despliegue en Base Mainnet (`0x9E5b...`), USDC nativo Circle, superficie agentic (`/llms.txt`, `/llms-full.txt`, `/agents.txt`), API `/api/services` con filtro por `capability`, catálogo semilla ($10–$35 USDC) y activos de código abierto (`README.md`, `LICENSE` Apache-2.0, `SECURITY.md`, `CONTRIBUTING.md`, auditoría de secretos limpia) | ✅ Completado |

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

### 🚀 Fase 1: Hardening, Despliegue en Base Mainnet & Agent Surface (Sprint 6)

**Objetivo:** Disponer de una plataforma productiva con dinero real en [mercadopleis.club](https://mercadopleis.club) y una superficie estructurada para que humanos y agentes de IA puedan descubrir y transaccionar servicios.

* **1.1. Smart Contract en Base Mainnet (`0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48`):** ✅ Completado
  * Verificado y público en [BaseScan](https://basescan.org/address/0x9e5b4c1112f026568233dc571dd4120dbe9fbf48#code) y [Sourcify](https://sourcify.dev/server/verify-ui/jobs/2f44398c-92ad-42a5-955f-a5f60cb23cfb).
  * Parámetros: 3% fee vendedor, 0% recargo comprador, árbitro oficial `0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00`.
* **1.2. Integración de USDC Oficial de Circle:** ✅ Completado
  * Token: [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) (USDC nativo en Base, 6 decimales).
* **1.3. Frontend en Producción:** ✅ Completado
  * Despliegue continuo en Netlify Edge, soporte bilingüe (ES/EN), Google Analytics integrado (`G-2GCQ3QTT5D`), viewport móvil optimizado.
* **1.4. Superficie de Descubrimiento Agentic en 3 Capas:** ✅ Completado
  * [`/llms.txt`](./apps/web/public/llms.txt): Índice curado y conciso (<60 líneas) con enlaces a documentación, contrato y endpoints según la especificación v2.
  * [`/llms-full.txt`](./apps/web/public/llms-full.txt): Manual de integración exhaustivo con métodos Solidity, parámetros de protocolo y guía Viem/TypeScript.
  * [`/agents.txt`](./apps/web/public/agents.txt): Manifiesto estructurado de identidad, capacidades (`service_discovery`, `escrow_funding`, `delivery_verification`), red y endpoints.
* **1.5. API de Comercio Agentic (`/api/services`):** ✅ Completado
  * Respuestas con protocolo `Mercadopleis Agent Commerce v1` y objetos estructurados de `price` y `settlement`.
  * Filtros por `capability`, `minPrice`, `maxPrice`, `maxDeliveryDays`, `category` y `deliveryType`.
  * Cabeceras CORS globales (`*`) y preflight `OPTIONS` habilitado.
* **1.6. Catálogo Semilla Inicial ($10 a $35 USDC):** ✅ Completado
  * 5 micro-servicios en producción en PostgreSQL Neon (transcripción de audio, curación de datasets JSONL, flujos n8n, red-teaming de prompts, scraping en Python).

---

### 🎯 Fase 2: GTM, Tracción Semilla & Agent Economy Wedge (Semanas 1 a 4)

**Objetivo:** Activar el flywheel de transacciones reales adquiriendo simultáneamente **clientes humanos y desarrolladores de agentes de IA**, apalancando la infraestructura de Base (agent wallets, Base MCP y pagos en USDC), según [`MARKETING_LAUNCH_PLAN.md`](./MARKETING_LAUNCH_PLAN.md).

#### 2.1. Estrategia Open Source: Protocolo Abierto & Repositorio Público como Canal de Adquisición y Confianza

Mercadopleis se posiciona como **infraestructura para la economía de agentes**. En este contexto, el repositorio público en GitHub (`castiquark/mercadopleis`) no es solo código fuente: funciona como **prueba técnica, superficie de descubrimiento orgánico y señal de confianza**.

Mantener el repositorio privado mientras se presenta el protocolo a agentes y desarrolladores generaba una contradicción con [`/llms.txt`](./apps/web/public/llms.txt). La apertura pública del repositorio resuelve esta fricción y activa cuatro ventajas competitivas:

1. **Credibilidad Técnica:**
   * El contrato ya está verificado en BaseScan (`0x9E5b...`), pero el repositorio público permite a cualquier builder auditar el sistema completo:
     * Cómo se calcula el fee de protocolo (`sellerPayout + platformFee == grossAmount`).
     * Cómo se gestiona el escrow non-custodial y la ventana de 5 días.
     * Cómo se manejan los reembolsos por timeout y el arbitraje en disputas.
     * La suite de tests e invariantes matemáticos con Foundry (`forge test`).
     * La especificación del API y los tipos de integración en TypeScript.
2. **Superficie de Descubrimiento Orgánico:**
   * GitHub se convierte en un embudo directo de adquisición técnica:
     ```text
     GitHub (castiquark/mercadopleis)
        ↓
     README.md (Badges, Quickstart, Invariantes)
        ↓
     Architecture & Smart Contracts (/contracts)
        ↓
     Base USDC Escrow (0x9E5b...)
        ↓
     mercadopleis.club (Producción)
     ```
   * Atrae específicamente a **desarrolladores de agentes de IA y builders Web3**, el perfil de mayor valor para la etapa de tracción.
3. **Contribuciones y Ecosistema:**
   * Facilita que la comunidad desarrolle integraciones con frameworks de agentes (Cursor, Mastra, LangChain, CrewAI), adaptadores MCP, SDKs en otros lenguajes y mejoras de documentación.
4. **Transparencia Radical:**
   * El mensaje *"El contrato está verificado en BaseScan y el protocolo es open source bajo Apache-2.0"* confiere el estándar de legitimidad requerido para manejar transacciones con dinero real.

##### Separación Estricta: Protocolo e Implementación de Referencia (Público) vs. Operación Interna (Privado)
*Open source ≠ Repositorio público sin filtro.* Mercadopleis establece una separación clara de responsabilidades:
* **Capa Pública (Código Abierto bajo Licencia Apache-2.0):**
  * `contracts/`: Smart contract en Solidity (`MarketplaceEscrow.sol`), scripts de despliegue y tests de invariantes con Foundry.
  * `apps/web/`: Implementación de referencia de la dApp (Next.js 15, Wagmi, Tailwind) y rutas de API (`/api/services`, `/api/orders`).
  * `packages/`: `@mercadopleis/contracts-abi`, `@mercadopleis/types`, `@mercadopleis/database` (esquema Drizzle).
  * `specs/` & discovery: `/llms.txt`, `/llms-full.txt`, `/agents.txt`, documentación de arquitectura y protocolos.
  * `examples/`: Ejemplos de integración autónoma en Viem y TypeScript.
  * Archivos de gobernanza: `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`.
* **Capa Privada (Operación Interna no publicada):**
  * Secretos de despliegue y credenciales de producción (`.env.local`, `.env.production`, connection strings de Neon DB, llaves privadas de deployer/árbitro, RPC credentials, webhook secrets, tokens de servicio).
  * Base de datos de producción y datos PII de usuarios.
  * Herramientas internas de administración y paneles de arbitraje confidencial.
  * Heurísticas propietarias de antifraude y moderación.
  * Analíticas internas de negocio y métricas de inteligencia comercial.

##### Decisión de Licenciamiento: Apache-2.0
Se adopta **Apache License 2.0** como licencia oficial del protocolo e implementación de referencia:
* **Ventaja:** Permite forks, SDKs e integraciones sin restricciones comerciales indebidas (máxima adopción), a la vez que incorpora cláusulas explícitas de protección y concesión recíproca de patentes.
* **Modelo Arquitectónico:**
  ```text
  Mercadopleis Protocol (Open Source — Apache-2.0)
       ├── Official Marketplace (https://mercadopleis.club)
       ├── Reference dApp & API (/apps/web)
       ├── Agent SDK & MCP Server (@mercadopleis/mcp-server)
       └── Third-Party Integrations & Agent Frameworks
  ```

##### Higiene de Secretos & Security Posture (`SECURITY.md`)
* Auditoría de historial Git completada: confirmación de que nunca se commitearon llaves privadas ni credenciales de base de datos (únicamente `.env.example`).
* Activación de GitHub Secret Scanning y GitHub Security Advisories en el repositorio público.
* Canal formal de divulgación responsable establecido: `security@mercadopleis.club` con SLA de respuesta de 48 horas.

---

#### 2.2. Estrategia de Adquisición Dual Simultánea
A diferencia de marketplaces tradicionales que buscan masa crítica de usuarios genéricos, la adquisición de Mercadopleis ataca dos perfiles con mensajes diferenciados:
1. **Compradores Humanos (Builders / Freelancers / Founders):**
   * *Mensaje:* "Contrata talento técnico y tareas de datos globales en USDC sin comisiones del 20%, con escrow seguro en Base."
2. **Desarrolladores de Agentes de IA (AI Agent Builders / MCP Devs):**
   * *Mensaje:* "Conecta tu agente a Mercadopleis y permítele subcontratar trabajo del mundo real (transcripciones, scraping, datasets) con custodia programable."

#### 2.3. Ampliación del Catálogo Semilla hacia 20 Servicios "Agent-Outsourceable"
Enfocados en tareas digitales concretas que un agente autónomo frecuentemente necesita delegar:
* **AI & Data:**
  * Transcripción de audio en español ($20 USDC)
  * Limpieza y deduplicación de datasets JSONL ($15 USDC)
  * Validación sintáctica y de esquema JSONL ($12 USDC)
  * Verificación humana de ground-truth ($10 USDC)
  * Evaluación y benchmarking de respuestas de LLMs ($15 USDC)
  * Anotación y etiquetado de imágenes ($15 USDC)
* **Development & Automation:**
  * Script en Python para web scraping estructurado ($25 USDC)
  * Workflow automatizado en n8n / Make con OpenAI o Claude ($35 USDC)
  * Integración y testeo de Webhook / API ($30 USDC)
  * Corrección puntual de bugs en TypeScript / Python ($20 USDC)
  * Revisión básica de Smart Contract en Solidity ($50 USDC)
* **Research & Intelligence:**
  * Web research estructurado en Markdown / CSV ($15 USDC)
  * Benchmarking de competidores o herramientas ($20 USDC)
  * Research técnico y recopilación cripto ($25 USDC)
  * Enriquecimiento de leads y extracción de contactos ($20 USDC)
* **Language & Translation:**
  * Traducción técnica EN/ES ($10 USDC)
  * Proofreading y corrección de estilo ($10 USDC)
  * Anotación semántica bilingüe ($20 USDC)

#### 2.4. Prioridad Tecnológica: Servidor Oficial `@mercadopleis/mcp-server`
Integración con la arquitectura **Base MCP** promovida por Base para que agentes en Cursor, Claude Desktop o frameworks como Mastra interactúen con herramientas nativas:
* `search_services(capability, maxPriceUsdc, maxDeliveryDays)`: Consulta el catálogo filtrando por capacidad técnica.
* `get_service(slugOrId)`: Obtiene la especificación completa, wallet del vendedor y plazo de entrega.
* `compare_services(capability)`: Compara candidatos por precio, reputación y tiempo de entrega.
* `create_order(serviceId, buyerWallet)`: Devuelve parámetros para fondear el escrow on-chain.
* `get_order_status(orderId)`: Monitorea el estado (`FUNDED`, `DELIVERED`, `RELEASED`).
* `get_delivery(orderId)`: Recupera la entrega y el hash criptográfico SHA-256 para verificación autónoma.

#### 2.5. Video Demo de 30-60 Segundos (Autonomous Hiring)
Creación y difusión de un video conciso demostrando el ciclo agentic:
```text
Usuario: "Consígueme un proveedor para transcribir este audio en español por menos de 25 USDC."
  ↓
Agente:
  → Consulta GET /api/services?capability=spanish-audio-transcription&maxPrice=25
  → Evalúa candidatos y selecciona el servicio de 20 USDC
  → Prepara la transacción de escrow en Base
  → Notifica al usuario / fondea con su wallet
  → Recibe la entrega y valida el hash SHA-256
  → Dispara la aprobación y liberación del pago en USDC
```

#### 2.6. Distribución en Canales de Ecosistema
* **Farcaster:** Canales clave `/base`, `/agents`, `/build`, `/beyond-ai`.
* **Base Builders & Ecosystem Hub:** Registro de proyecto en el directorio oficial de proyectos de Base.
* **X (Twitter):** Hilo técnico analizando el modelo de custodia programable vs. intermediarios Web2.
* **Reddit Técnico:** `/r/ethereum`, `/r/base`, `/r/localllama`, `/r/sideproject`.
* **Outreach Directo:** 1-a-1 con desarrolladores de agentes, automatizadores de n8n y creadores de prompts.

#### 2.7. El Ciclo de PMF (Product-Market Fit Loop)
```text
agent discovers service
         ↓
 service gets hired
         ↓
  provider delivers
         ↓
 buyer releases USDC
         ↓
  verified review
         ↓
another agent discovers
         ↓
      repeat
```

#### 2.8. Métricas de Éxito de la Fase 2:
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
  * Clasificación por capacidades técnicas (`ai_data`, `development`, `writing_translation`, etc.).
* **3.2. Postulación de Prestadores:**
  * Sistema de propuestas técnicas con cotización personalizada y plazo propuesto.
* **3.3. Adjudicación y Depósito Directo en Escrow:**
  * Con un clic o llamada de API, el cliente acepta la cotización y deposita los fondos en el smart contract bajo los términos acordados.

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
