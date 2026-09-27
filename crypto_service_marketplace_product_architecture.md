# Crypto Service Marketplace — Product & Architecture Specification

**Documento:** Product & Architecture Specification  
**Versión:** 1.0  
**Estado:** Propuesta / Base para MVP  
**Modelo:** Marketplace internacional de servicios, wallet-native y non-custodial  
**Unidad de pago inicial:** USDC  
**Blockchain inicial propuesta:** Base  
**Smart contracts:** Solidity + OpenZeppelin  
**Frontend:** React / Next.js + Tailwind  
**Backend:** Node.js + Express  
**Base de datos:** PostgreSQL

---

## 1. Resumen ejecutivo

El producto es un marketplace internacional de servicios en el que prestadores y clientes pueden descubrir, contratar, reservar y liquidar servicios utilizando exclusivamente criptomonedas, con USDC como medio de pago inicial.

La diferencia central frente a un marketplace tradicional no es simplemente aceptar crypto como método de pago. El producto está diseñado desde el principio alrededor de wallets, smart contracts y escrow programable.

El flujo fundamental es:

```text
Prestador publica servicio
        ↓
Cliente conecta wallet
        ↓
Cliente reserva
        ↓
USDC entra en escrow
        ↓
Prestador ejecuta servicio
        ↓
Cliente acepta / milestone aprobado
        ↓
Smart contract libera USDC
        ↓
Prestador recibe pago
        ↓
Marketplace recibe comisión
```

El marketplace no necesita custodiar las claves privadas de los usuarios ni mantener balances internos de crypto. La intención arquitectónica es que los fondos de una orden permanezcan bajo las reglas del smart contract hasta que se cumplan las condiciones de liberación, devolución o resolución de disputa.

El producto puede evolucionar desde un marketplace de servicios hacia una infraestructura de contratación programable con:

- escrow;
- milestones;
- reputación verificable;
- pagos recurrentes;
- solicitudes de servicios;
- ofertas competitivas;
- arbitraje;
- reputación portable;
- agentes de IA capaces de contratar servicios.

---

# 2. Problema

Los marketplaces globales de servicios presentan varios fricciones estructurales:

1. Dependencia de tarjetas, cuentas bancarias o procesadores de pagos.
2. Restricciones geográficas y disponibilidad desigual de métodos de pago.
3. Costos y tiempos de liquidación internacionales.
4. Riesgo de chargebacks.
5. Custodia centralizada del dinero durante el proceso de contratación.
6. Reputación encerrada dentro de una plataforma.
7. Complejidad para crear contratos de pago más flexibles.

El producto busca resolver principalmente la infraestructura de contratación y liquidación, no reemplazar todos los componentes de un marketplace tradicional con blockchain.

---

# 3. Propuesta de valor

## Para clientes

- Contratar servicios internacionalmente sin tarjeta.
- Pagar mediante wallet.
- Saber que el dinero queda bloqueado en escrow antes de la entrega.
- Utilizar milestones para trabajos complejos.
- Disponer de historial de operaciones verificable.

## Para prestadores

- Acceso a clientes internacionales.
- Cobro en stablecoin.
- Menor exposición a chargebacks tradicionales.
- Pago automático una vez cumplidas las condiciones de la orden.
- Historial y reputación potencialmente portables.

## Para el marketplace

- Modelo non-custodial como objetivo arquitectónico.
- Comisión automática en cada transacción.
- Menor necesidad de gestionar saldos internos.
- Posibilidad de añadir nuevas redes y activos posteriormente.
- Smart contracts reutilizables como infraestructura de escrow.

---

# 4. Principios de producto

## 4.1 Wallet-native

La wallet representa la identidad criptográfica principal del usuario.

La aplicación puede ofrecer perfiles convencionales, pero la relación económica fundamental será:

```text
User Profile ↔ Wallet / Smart Account
```

## 4.2 Non-custodial por diseño

El backend no debe disponer de una clave maestra que permita mover los fondos depositados por usuarios.

La lógica de pago debe residir en smart contracts auditables.

## 4.3 Web2 UX + Web3 settlement

El usuario debería sentir que utiliza un marketplace normal.

La complejidad de:

- gas;
- chain IDs;
- nonce;
- contract addresses;
- transaction hashes;
- RPCs;

debe permanecer oculta tanto como sea posible.

## 4.4 Stablecoin first

El MVP utilizará USDC como unidad económica principal.

No se recomienda lanzar inicialmente un token propio del marketplace.

## 4.5 Blockchain para lo que aporta valor

No almacenar en blockchain:

- mensajes;
- imágenes;
- perfiles completos;
- búsquedas;
- contenido largo;
- archivos de trabajo;
- metadata mutable innecesaria.

Sí utilizar blockchain para:

- escrow;
- ownership lógico de órdenes;
- movimientos de fondos;
- milestones;
- estados financieros verificables;
- eventos de reputación que se quieran hacer portables.

---

# 5. Personas y roles

## 5.1 Buyer / Cliente

Puede:

- buscar servicios;
- guardar servicios;
- solicitar servicios;
- reservar;
- financiar órdenes;
- aprobar entregas;
- abrir disputas;
- puntuar al prestador.

## 5.2 Seller / Prestador

Puede:

- crear perfil;
- publicar servicios;
- establecer precio;
- definir entregables;
- definir tiempos;
- configurar milestones;
- aceptar órdenes;
- entregar resultados;
- solicitar liberación de fondos.

## 5.3 Arbitrator / Moderador

Interviene en disputas.

En MVP puede ser un rol administrado de forma centralizada, pero el contrato debe diseñarse de forma que posteriormente pueda sustituirse por un sistema de arbitraje más descentralizado.

## 5.4 Marketplace Operator

Administra:

- categorías;
- contenido;
- moderación;
- parámetros del protocolo;
- fee configurable;
- políticas;
- resolución operacional.

El operator no debe poder retirar unilateralmente fondos de órdenes activas.

---

# 6. Modelo de negocio

## 6.1 Comisión principal

Ejemplo:

```text
Servicio                    100 USDC
Marketplace fee               5 USDC
Total cliente                105 USDC
Prestador recibe              95 USDC
```

La división puede producirse directamente dentro del contrato al hacer `release`.

## 6.2 Posibles ingresos futuros

- Comisión por transacción.
- Fee por determinados tipos de servicios.
- Servicios premium para prestadores.
- Promoción de servicios.
- Suscripciones profesionales.
- Herramientas SaaS para vendedores.
- API para terceros.
- Infraestructura white-label.

No se recomienda introducir staking o token propio hasta validar primero el marketplace y su economía real.

---

# 7. Marketplace: tipos de contratación

El sistema debería soportar dos modalidades.

## 7.1 Catalog Marketplace

El prestador publica una oferta:

```text
"Diseño una landing page"

Precio: 150 USDC
Entrega: 5 días
```

El cliente compra directamente.

## 7.2 Request Marketplace

El cliente publica una necesidad:

```text
Necesito una landing page para una cafetería.

Presupuesto: 500 USDC
Plazo: 20 días
```

Los prestadores envían propuestas.

```text
REQUEST
   ↓
PROPOSALS
   ↓
BUYER SELECTS
   ↓
ESCROW ORDER
```

Esta funcionalidad no es imprescindible para el MVP técnico, pero debe considerarse desde el modelo de datos inicial.

---

# 8. Categorías iniciales

Se recomienda comenzar con servicios digitales de baja fricción física y alta posibilidad de entrega verificable:

- programación;
- diseño gráfico;
- diseño web;
- edición de video;
- traducción;
- redacción;
- marketing;
- consultoría;
- investigación;
- educación;
- soporte técnico;
- servicios creativos.

Los servicios físicos, regulados, financieros, médicos, legales o que impliquen bienes restringidos deben requerir políticas y análisis de cumplimiento específicos antes de habilitarse.

---

# 9. UX principal

## 9.1 Home

```text
-----------------------------------------------
Find a service

[ Search services... ]

Programming   Design   Education   Marketing
Consulting    Writing  Video       Translation
-----------------------------------------------
```

## 9.2 Página de servicio

```text
-----------------------------------------------
I will build your React website

⭐ 4.98    125 completed

150 USDC
Delivery: 5 days

What you receive
- Responsive website
- Source code
- Deployment

[ Book service ]
-----------------------------------------------
```

## 9.3 Checkout

```text
Order summary

React website                 150 USDC
Marketplace fee                 7.50 USDC
--------------------------------
Total                         157.50 USDC

Payment secured by escrow

[ Confirm with wallet ]
```

## 9.4 Después de pagar

```text
Payment secured ✓

157.50 USDC are locked in escrow.

The seller will receive the seller amount
when the service is approved.
```

---

# 10. Escrow: núcleo del protocolo

El escrow es el principal componente on-chain del producto.

## 10.1 Estados

```text
CREATED
   ↓
FUNDED
   ↓
IN_PROGRESS
   ↓
DELIVERED
   ↓
RELEASED
```

Rama de disputa:

```text
DELIVERED
   ↓
DISPUTED
   ↓
RESOLVED
   ├── RELEASE
   └── REFUND
```

Posibles cancelaciones:

```text
CREATED → CANCELLED
FUNDED  → REFUNDED
```

La máquina exacta de estados debe quedar formalizada antes de desplegar el contrato.

---

# 11. Modelo de orden

Ejemplo lógico:

```text
Order
├── orderId
├── buyer
├── seller
├── serviceId
├── token
├── grossAmount
├── platformFee
├── sellerAmount
├── deadline
├── createdAt
├── fundedAt
├── deliveredAt
├── releasedAt
├── status
└── milestones[]
```

En blockchain solo se almacenará la información necesaria para ejecutar y auditar la lógica financiera.

---

# 12. Smart Contract Architecture

## 12.1 Contratos principales

MVP:

```text
MarketplaceEscrow.sol
```

Opcionalmente separados posteriormente:

```text
MarketplaceConfig.sol
ReputationRegistry.sol
Arbitration.sol
FeeSplitter.sol
```

## 12.2 Dependencias

Se recomienda utilizar librerías maduras para:

- ERC-20 Safe Transfer;
- Access Control;
- Reentrancy protection;
- Pausable emergency controls;
- upgradeability únicamente si realmente es necesaria.

---

# 13. Interfaz conceptual del escrow

El contrato puede exponer funciones de este estilo:

```solidity
createOrder(
    address seller,
    address token,
    uint256 amount,
    uint256 deadline
)

fundOrder(uint256 orderId)

startOrder(uint256 orderId)

submitDelivery(uint256 orderId, bytes32 deliveryHash)

approveDelivery(uint256 orderId)

releaseFunds(uint256 orderId)

refundOrder(uint256 orderId)

openDispute(uint256 orderId)

resolveDispute(
    uint256 orderId,
    uint256 sellerAmount,
    uint256 buyerRefund
)

cancelOrder(uint256 orderId)
```

La interfaz definitiva debe surgir de una especificación formal de invariantes y estados antes de escribir el contrato de producción.

---

# 14. Milestones

Los trabajos complejos deben admitir múltiples entregables.

Ejemplo:

```text
Proyecto: Web empresarial
Total: 1.000 USDC

Milestone 1 — Wireframes       250 USDC
Milestone 2 — Frontend         250 USDC
Milestone 3 — Backend          250 USDC
Milestone 4 — Deployment       250 USDC
```

El escrow mantiene los fondos correspondientes a cada milestone hasta su aprobación o resolución.

Esto permite aplicar el marketplace a proyectos de mayor tamaño sin exigir que todo el dinero quede pendiente hasta el final.

---

# 15. Auto-release

Para evitar fondos bloqueados indefinidamente, cada orden puede definir reglas de timeout.

Ejemplo conceptual:

```text
seller submits delivery
        ↓
buyer has N hours/days to dispute
        ↓
no dispute
        ↓
auto-release eligible
```

El período exacto debe ser configurable por categoría o producto.

El backend nunca debería liberar dinero directamente; debe ejecutar solamente las acciones permitidas por el contrato.

---

# 16. Disputas

## 16.1 Problema

El blockchain puede verificar:

- que se depositó dinero;
- quién debía recibirlo;
- qué estado alcanzó una orden;
- qué transacciones ocurrieron.

No puede determinar por sí solo si una landing page cumple las expectativas del cliente.

Por eso se necesita una capa de resolución de disputas.

## 16.2 MVP

Modelo híbrido:

```text
Buyer
Seller
   ↓
Dispute
   ↓
Marketplace moderator
   ↓
On-chain resolution
```

## 16.3 Futuro

Posibles mecanismos:

- jurados descentralizados;
- proveedores externos de arbitraje;
- staking de arbitrators;
- votación ponderada;
- sistemas de reputación de árbitros.

No es necesario descentralizar esta capa desde el primer día.

---

# 17. Evidencia de entrega

Los archivos grandes permanecen off-chain.

Flujo:

```text
Seller uploads delivery
        ↓
Object storage / IPFS
        ↓
Hash generated
        ↓
Hash registered on-chain
```

Ejemplo:

```text
SHA-256 / content hash
        ↓
0xABCD...
```

La finalidad es poder demostrar posteriormente qué contenido estaba asociado a la entrega registrada.

---

# 18. Reputación

La reputación es un componente estratégico.

## 18.1 Datos básicos

```text
Completed services: 83
Completion rate: 98%
Disputes: 1
Average rating: 4.91
Volume: 12,430 USDC
```

## 18.2 Reputación off-chain

En MVP, ratings y perfiles pueden vivir en PostgreSQL.

## 18.3 Reputación verificable

En una fase posterior:

```text
Completed order
      ↓
On-chain event
      ↓
Reputation indexer
      ↓
Portable reputation
```

Puede utilizarse un sistema de attestations o credenciales verificables.

No se recomienda convertir inmediatamente la reputación en un NFT especulativo. El objetivo inicial es que sea una credencial útil, verificable y portable.

---

# 19. Identidad y wallets

## 19.1 MVP

Opciones:

- WalletConnect;
- Coinbase Wallet;
- MetaMask;
- otras wallets EVM compatibles.

## 19.2 Smart Accounts

La arquitectura debe reservar espacio para smart accounts porque permiten una UX más parecida a una aplicación Web2:

- recuperación;
- batching;
- patrocinio de gas;
- políticas programables.

## 19.3 Perfil

Ejemplo:

```text
Pablo
Uruguay

Wallet verified
⭐ 4.92
83 completed services
$12,430 volume
```

El perfil público no debe exponer innecesariamente información sensible de la wallet o del usuario.

---

# 20. Gas abstraction

El objetivo de UX es minimizar la necesidad de que un usuario nuevo compre una criptomoneda distinta de USDC solo para pagar gas.

Arquitectura objetivo:

```text
User
  ↓
Smart Account
  ↓
Bundler / Account Abstraction
  ↓
Paymaster
  ↓
Blockchain
```

El marketplace puede subsidiar determinadas operaciones, especialmente:

- creación de cuenta;
- creación de orden;
- operaciones de bajo costo.

La política de subsidios deberá tener límites contra abuso y farming.

---

# 21. Blockchain strategy

## Fase 1

Una sola red:

```text
Base
```

Una sola moneda:

```text
USDC
```

Una infraestructura de escrow.

## Fase 2

Agregar redes compatibles con la arquitectura cuando exista volumen suficiente para justificarlo.

Posibles candidatas:

```text
Ethereum
Arbitrum
Optimism
Polygon
otras redes EVM
```

## Fase 3

Payment Router / Cross-chain abstraction.

Objetivo:

```text
Buyer wallet
       ↓
Payment Router
       ↓
Settlement
       ├── Chain A
       ├── Chain B
       └── Chain C
```

La multichain no debe introducirse en el MVP porque multiplica la superficie de errores, liquidez, soporte y reconciliación.

---

# 22. Backend architecture

```text
                    ┌─────────────────────┐
                    │      Frontend       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       API           │
                    │ Node.js / Express   │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼─────────────────────┐
        │                      │                     │
        ▼                      ▼                     ▼
 PostgreSQL              Object Storage         Blockchain RPC
        │                                            │
        │                                            ▼
        │                                     Smart Contracts
        │                                            │
        └──────────────────────┬─────────────────────┘
                               ▼
                         Event Indexer
```

---

# 23. Servicios backend

Se recomienda separar conceptualmente:

```text
Auth Service
Marketplace Service
Orders Service
Payment Service
Blockchain Service
Reputation Service
Dispute Service
Notification Service
Search Service
```

En MVP pueden vivir dentro de un único backend modular. No es necesario implementar microservicios desde el principio.

---

# 24. Base de datos

## users

```text
id
wallet_address
smart_account_address
username
display_name
country
language
bio
avatar_url
created_at
updated_at
status
```

## services

```text
id
seller_id
title
slug
description
category_id
base_price_usdc
delivery_days
status
created_at
updated_at
```

## service_packages

```text
id
service_id
name
price_usdc
delivery_days
description
```

## orders

```text
id
service_id
buyer_id
seller_id
chain_id
contract_order_id
token_address
gross_amount
platform_fee
seller_amount
status
deadline
created_at
funded_at
delivered_at
released_at
```

## milestones

```text
id
order_id
position
title
description
amount_usdc
status
deadline
submitted_at
approved_at
```

## proposals

```text
id
request_id
seller_id
amount_usdc
delivery_days
message
status
created_at
```

## requests

```text
id
buyer_id
title
description
budget_min_usdc
budget_max_usdc
deadline
status
created_at
```

## reviews

```text
id
order_id
reviewer_id
reviewed_user_id
rating
comment
created_at
```

## disputes

```text
id
order_id
opened_by
reason
evidence_reference
status
resolution
created_at
resolved_at
```

## blockchain_transactions

```text
id
order_id
tx_hash
chain_id
type
status
block_number
created_at
confirmed_at
```

---

# 25. API

## Authentication

```http
POST /api/auth/nonce
POST /api/auth/verify
GET  /api/auth/me
```

## Users

```http
GET   /api/users/:username
PATCH /api/users/me
```

## Services

```http
GET    /api/services
GET    /api/services/:slug
POST   /api/services
PATCH  /api/services/:id
DELETE /api/services/:id
```

## Orders

```http
POST /api/orders
GET  /api/orders/:id
GET  /api/orders/my
POST /api/orders/:id/submit
POST /api/orders/:id/approve
POST /api/orders/:id/dispute
```

## Requests

```http
GET  /api/requests
POST /api/requests
GET  /api/requests/:id
POST /api/requests/:id/proposals
```

## Reviews

```http
POST /api/orders/:id/review
GET  /api/users/:id/reviews
```

## Blockchain

```http
GET /api/orders/:id/transactions
GET /api/blockchain/status/:txHash
```

---

# 26. Blockchain event indexer

El backend no debe asumir que una transacción enviada significa que la operación quedó confirmada.

Flujo:

```text
Frontend
  ↓
wallet transaction
  ↓
Blockchain
  ↓
event emitted
  ↓
Indexer
  ↓
PostgreSQL
  ↓
Frontend updated
```

Eventos sugeridos:

```solidity
OrderCreated
OrderFunded
OrderStarted
DeliverySubmitted
MilestoneApproved
FundsReleased
RefundIssued
DisputeOpened
DisputeResolved
OrderCancelled
```

El indexer debe ser idempotente.

---

# 27. Seguridad del smart contract

Antes de producción:

- protección contra reentrancy;
- uso correcto de SafeERC20;
- control de acceso;
- validación exhaustiva de estados;
- límites para fees;
- prevención de doble release;
- prevención de doble refund;
- prevención de doble resolución;
- checks-effects-interactions;
- eventos completos;
- testing unitario;
- fuzz testing;
- invariant testing;
- revisión externa / auditoría.

## Invariantes críticas

Ejemplos:

```text
released + refunded + remaining = funded
```

Nunca debe cumplirse:

```text
released > funded
```

ni:

```text
refund + seller payout + fees > funded
```

Una orden debe tener como máximo una liquidación final.

---

# 28. Seguridad del backend

- Firma de mensajes para autenticación.
- Rate limiting.
- Protección contra replay.
- Validación de ownership.
- Control de permisos por recurso.
- Logs de auditoría.
- Webhooks/event listeners robustos.
- Idempotency keys para operaciones sensibles.
- Protección contra spam de órdenes.
- Detección de abuso de promociones y gas sponsorship.

---

# 29. Moderación

Blockchain no elimina la necesidad de moderación del marketplace.

Debe existir un sistema para:

- reportar servicios;
- retirar contenido ilegal o abusivo de la interfaz;
- bloquear perfiles;
- prevenir fraude;
- gestionar categorías restringidas;
- limitar spam.

Eliminar un servicio de la interfaz no requiere borrar necesariamente sus eventos históricos on-chain.

---

# 30. Compliance y jurisdicción

Este proyecto debe diseñarse con asesoramiento legal antes del lanzamiento comercial.

Los aspectos a revisar incluyen, según jurisdicción:

- tratamiento de criptoactivos;
- stablecoins;
- servicios de transferencia o custodia;
- AML/KYC cuando corresponda;
- sanciones;
- protección al consumidor;
- impuestos;
- privacidad;
- servicios restringidos;
- marketplace liability;
- geoblocking.

Una arquitectura non-custodial puede reducir determinadas exposiciones, pero no elimina automáticamente todas las obligaciones regulatorias.

La plataforma debe definir desde el principio los países atendidos y una política de exclusión geográfica para jurisdicciones o actividades que requieran controles adicionales.

---

# 31. Privacidad

Nunca asumir que la wallet equivale automáticamente a anonimato.

Transacciones públicas pueden permitir análisis de actividad financiera.

El producto debería separar:

```text
Public profile
Wallet identifier
Private account data
Operational metadata
```

No publicar innecesariamente:

- dirección física;
- documentos de identidad;
- información privada;
- datos personales sensibles.

Los documentos de disputas y trabajo deben mantenerse fuera de la cadena.

---

# 32. Fraude y abuso

Amenazas iniciales:

### Fake sellers

Mitigación:

- reputación;
- verified wallet;
- historial;
- límites para cuentas nuevas;
- moderación.

### Fake buyers

Mitigación:

- funding requirement;
- dispute rules;
- account history.

### Self-trading / review farming

Mitigación:

- detección de wallets relacionadas;
- límites;
- análisis de patrones;
- reputación ponderada por historial real.

### Gas sponsorship abuse

Mitigación:

- límites por wallet;
- rate limiting;
- minimum order value;
- anti-sybil.

---

# 33. Fees y economía del escrow

La comisión debe ser explícita.

Ejemplo:

```text
Base service price       100 USDC
Marketplace fee             5 USDC
Buyer pays                 105 USDC
Seller receives             95 USDC
```

Otra posibilidad:

```text
Buyer pays                100 USDC
Seller receives             95 USDC
Marketplace receives         5 USDC
```

La opción elegida debe documentarse claramente en la UX para evitar discrepancias entre precio mostrado y precio liquidado.

---

# 34. Refunds

Debe distinguirse:

1. Cancelación antes del funding.
2. Cancelación antes de comenzar.
3. Cancelación durante ejecución.
4. Refund por timeout.
5. Refund por disputa.
6. Refund parcial por milestone.

Los algoritmos de devolución deben formar parte del contrato y no ser una decisión manual de backend.

---

# 35. Subscription services

Fase posterior.

Ejemplos:

```text
$50 USDC / month
```

o:

```text
$200 USDC / month
```

Casos:

- soporte técnico;
- diseño continuo;
- community management;
- consultoría;
- mantenimiento web.

Requiere un sistema de autorización / recurring payments específico y debe incorporarse solamente después de estabilizar el escrow de órdenes únicas.

---

# 36. AI agents

Una evolución estratégica es permitir que agentes de IA participen como clientes o proveedores.

Ejemplo:

```text
AI agent
   ↓
Busca servicio
   ↓
Compara precio/reputación
   ↓
Contrata
   ↓
Paga USDC
   ↓
Supervisa milestone
   ↓
Aprueba entrega
```

Esto puede convertir al marketplace en una capa de servicios que puedan consumir programas, no solamente personas.

En el futuro podrían existir:

```text
Human → Human
Human → AI service
AI → Human
AI → AI
```

---

# 37. Reputación para agentes

El mismo sistema puede utilizarse para agentes automatizados.

Ejemplo:

```text
Agent wallet

Completed: 1,240
Disputes: 12
Success rate: 99%
Volume: 450,000 USDC
```

El historial on-chain puede convertirse en una identidad económica programable.

---

# 38. Token propio

## Decisión MVP

**No crear token propio.**

El marketplace puede ser plenamente Web3 utilizando:

```text
Wallets
Smart Contracts
USDC
Escrow
On-chain reputation
```

## Posible fase futura

Un token solo debería considerarse después de demostrar una utilidad clara.

Posibles usos hipotéticos:

- governance;
- descuentos;
- staking de arbitrators;
- incentivos de reputación;
- acceso a herramientas premium.

El lanzamiento de un token debe evaluarse además desde el punto de vista jurídico, económico y de seguridad.

---

# 39. Arquitectura de carpetas propuesta

```text
marketplace/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── contracts/
│   ├── ui/
│   ├── blockchain/
│   ├── types/
│   └── config/
│
├── contracts/
│   ├── src/
│   │   ├── MarketplaceEscrow.sol
│   │   ├── ReputationRegistry.sol
│   │   └── interfaces/
│   ├── test/
│   └── deploy/
│
├── infra/
│   ├── docker/
│   └── migrations/
│
├── docs/
│   ├── product.md
│   ├── architecture.md
│   ├── contracts.md
│   └── security.md
│
└── package.json
```

Monorepo con pnpm es una buena opción para compartir tipos, ABI, componentes y configuración entre frontend, backend y contratos.

---

# 40. Flujo completo de una orden

```text
1. Seller creates service
        ↓
2. API stores service metadata
        ↓
3. Buyer opens service
        ↓
4. Buyer connects wallet
        ↓
5. Buyer creates order
        ↓
6. Frontend asks wallet to authorize USDC
        ↓
7. USDC transferred to escrow
        ↓
8. Contract emits OrderFunded
        ↓
9. Indexer records funding
        ↓
10. Seller starts work
        ↓
11. Seller submits delivery
        ↓
12. Buyer approves
        ↓
13. Contract calculates seller payout + fee
        ↓
14. Contract releases funds
        ↓
15. Indexer updates order
        ↓
16. Buyer leaves review
```

---

# 41. Request flow

```text
Buyer creates request
        ↓
Marketplace publishes request
        ↓
Sellers submit proposals
        ↓
Buyer selects proposal
        ↓
Order created
        ↓
Escrow funded
        ↓
Work begins
```

---

# 42. Dispute flow

```text
Delivery submitted
        ↓
Buyer disputes
        ↓
Funds remain locked
        ↓
Evidence submitted
        ↓
Moderator / arbitrator reviews
        ↓
Resolution submitted on-chain
        ↓
┌────────────────────────────┐
│ seller payout +/or refund  │
└────────────────────────────┘
```

---

# 43. MVP scope

El MVP debe ser deliberadamente pequeño.

## Incluido

- Landing page.
- Registro mediante wallet.
- Perfil de usuario.
- Crear servicio.
- Buscar servicios.
- Categorías.
- Página de servicio.
- Checkout.
- USDC.
- Una blockchain.
- Escrow.
- Orden simple de un solo milestone.
- Entrega.
- Aprobación.
- Release.
- Refund.
- Dispute básica.
- Reviews.
- Dashboard buyer/seller.
- Event indexer.
- Historial de transacciones.

## Fuera del MVP

- Multichain.
- Token propio.
- DAO.
- Arbitraje descentralizado.
- Suscripciones.
- Agentes autónomos.
- Matching complejo con IA.
- Cross-chain bridges.
- Stablecoins múltiples.
- Marketplace físico a gran escala.

---

# 44. Fase 2

Después de validar el MVP:

- milestones;
- request marketplace;
- propuestas;
- smart accounts;
- gas sponsorship;
- reputación verificable;
- más categorías;
- mejores herramientas de vendedor;
- analítica;
- protección anti-fraude;
- suscripciones.

---

# 45. Fase 3

- multichain;
- portable reputation;
- arbitration marketplace;
- API pública;
- agentes de IA;
- programmatic purchasing;
- recurring payments;
- third-party integrations;
- white-label marketplace infrastructure.

---

# 46. Métricas fundamentales

## Marketplace

```text
GMV
Transactions
Active buyers
Active sellers
Completed orders
Cancellation rate
Dispute rate
```

## Economía

```text
Average order value
Take rate
Revenue
Gas sponsorship cost
Infrastructure cost
Net contribution per order
```

## Calidad

```text
Completion rate
Refund rate
Dispute rate
Median delivery time
Average rating
Repeat purchase rate
```

## Web3

```text
Wallet conversion rate
First transaction success rate
Failed transaction rate
Gas subsidy per user
Gas subsidy per order
USDC volume
Active wallets
```

---

# 47. North Star Metric

Una métrica recomendada para la primera etapa:

> **Completed service GMV per month**

Complementada por:

> **Repeat buyer rate**

El objetivo no es maximizar transacciones on-chain por sí mismas, sino servicios realmente completados.

---

# 48. Arquitectura de confianza

La propuesta puede dividirse en cuatro capas:

```text
┌───────────────────────────────┐
│ UX TRUST                      │
│ profiles / ratings / support  │
├───────────────────────────────┤
│ MARKETPLACE TRUST             │
│ moderation / disputes         │
├───────────────────────────────┤
│ PROTOCOL TRUST                │
│ escrow / contracts            │
├───────────────────────────────┤
│ BLOCKCHAIN TRUST              │
│ immutable settlement history  │
└───────────────────────────────┘
```

Blockchain resuelve principalmente la capa de settlement y ciertas pruebas de integridad. No resuelve por sí sola la confianza interpersonal del marketplace.

---

# 49. Principales riesgos del proyecto

## Riesgo 1 — Poca liquidez

Un marketplace nuevo puede tener muchos servicios y pocos compradores.

Respuesta:

- comenzar con categorías concretas;
- reclutar prestadores antes del lanzamiento;
- incentivar primeros servicios;
- priorizar mercados con demanda clara.

## Riesgo 2 — Fricción Web3

Si el usuario necesita comprender blockchain, la conversión caerá.

Respuesta:

- Smart Accounts;
- gas abstraction;
- UX similar a Web2;
- onboarding progresivo.

## Riesgo 3 — Disputas difíciles

La blockchain no sabe si un trabajo creativo es bueno.

Respuesta:

- escrow + moderación;
- milestones;
- políticas claras;
- evidencia estructurada.

## Riesgo 4 — Fraude

El marketplace puede atraer cuentas falsas y colusión.

Respuesta:

- reputación;
- limits;
- risk scoring;
- anti-Sybil;
- moderación.

## Riesgo 5 — Complejidad regulatoria

El modelo internacional puede estar sujeto a obligaciones diferentes según jurisdicción.

Respuesta:

- arquitectura non-custodial;
- counsel legal por mercados objetivo;
- restricciones geográficas;
- políticas de servicios admitidos.

---

# 50. Decisiones técnicas recomendadas

| Área | Decisión MVP |
|---|---|
| Frontend | React / Next.js |
| Styling | Tailwind |
| Backend | Node.js / Express |
| Database | PostgreSQL |
| ORM | Prisma o Drizzle |
| Blockchain | Base |
| Token | USDC |
| Smart contracts | Solidity |
| Contract libs | OpenZeppelin |
| Web3 client | Viem |
| React wallet layer | Wagmi |
| Storage | S3-compatible + opcional IPFS |
| Auth | Wallet signature |
| Indexing | Backend event indexer |
| Monorepo | pnpm |
| Testing contracts | Foundry / Hardhat |
```

---

# 51. Testing strategy

## Smart contracts

- unit tests;
- integration tests;
- fuzz tests;
- invariant tests;
- fork tests;
- emergency path tests.

## Backend

- unit tests;
- integration tests;
- authorization tests;
- idempotency tests;
- blockchain event reconciliation.

## Frontend

- wallet connection tests;
- transaction state tests;
- failed transaction handling;
- chain switch handling;
- mobile UX.

## End-to-end

Caso mínimo obligatorio:

```text
seller creates service
      ↓
buyer orders
      ↓
USDC escrow funded
      ↓
seller delivers
      ↓
buyer approves
      ↓
funds released
      ↓
fee distributed
      ↓
review submitted
```

---

# 52. Observabilidad

Registrar:

- request ID;
- user ID;
- wallet;
- order ID;
- transaction hash;
- contract event;
- API latency;
- failure type;
- blockchain confirmation state.

Debe ser posible reconstruir de forma determinista qué ocurrió con una orden.

---

# 53. Administración

Panel interno mínimo:

```text
Users
Services
Orders
Transactions
Disputes
Reports
Categories
Fees
Blocked wallets
System health
```

Nunca permitir desde el panel:

> “Transferir fondos de cualquier orden”.

Las acciones financieras deben seguir las reglas del contrato.

---

# 54. Política de estados de blockchain

El frontend debe distinguir:

```text
Wallet signed
       ↓
Transaction submitted
       ↓
Pending
       ↓
Confirmed
       ↓
Indexed
```

No mostrar simplemente:

> “Pago realizado”

hasta tener confirmación suficiente para el flujo definido.

---

# 55. Recuperación ante fallos

Casos que deben estar contemplados:

### Usuario cierra navegador después de firmar

El indexer debe detectar posteriormente la transacción.

### API está caída pero blockchain funciona

El estado on-chain debe seguir siendo la fuente de verdad financiera.

### Blockchain RPC falla

Usar múltiples endpoints / mecanismos de fallback.

### Indexer se reinicia

Los eventos deben poder reindexarse de forma idempotente.

### Transacción revierte

Mostrar claramente el fallo y permitir retry cuando sea seguro.

---

# 56. Fuentes de verdad

## Blockchain

Fuente de verdad para:

- funding;
- balances escrow;
- releases;
- refunds;
- fee settlement;
- estado financiero.

## PostgreSQL

Fuente de verdad operacional para:

- perfiles;
- catálogo;
- búsquedas;
- mensajes;
- metadata;
- preferencias;
- índices derivados.

En caso de inconsistencia financiera, la blockchain tiene prioridad y la base se reconstruye mediante indexación.

---

# 57. Modelo de confianza recomendado

No prometer:

> “El blockchain elimina el fraude.”

Promesa técnicamente más precisa:

> “El escrow hace que la liquidación siga reglas verificables y reduce la dependencia de la custodia centralizada del dinero.”

La plataforma sigue siendo responsable de:

- selección y descubrimiento;
- moderación;
- experiencia;
- soporte;
- resolución de disputas;
- prevención del abuso.

---

# 58. Roadmap técnico sugerido

## Sprint 0 — Diseño

- definir nombre;
- definir categorías iniciales;
- definir modelo de comisión;
- definir reglas de cancelación;
- definir política de disputa;
- formalizar estados del contrato;
- threat model.

## Sprint 1 — Marketplace básico

- frontend;
- perfiles;
- servicios;
- categorías;
- búsqueda;
- API;
- PostgreSQL.

## Sprint 2 — Wallet

- wallet connection;
- SIWE / firma;
- perfiles vinculados a wallet;
- chain configuration.

## Sprint 3 — Escrow

- contrato;
- tests;
- deployment testnet;
- frontend transaction flows;
- event indexer.

## Sprint 4 — Orders

- dashboard;
- funding;
- delivery;
- approval;
- refund;
- transaction history.

## Sprint 5 — Reviews + disputes

- ratings;
- reviews;
- evidence;
- moderation dashboard;
- dispute resolution.

## Sprint 6 — Security / launch preparation

- fuzz/invariant tests;
- monitoring;
- rate limits;
- backups;
- contract review;
- legal review;
- production deployment.

---

# 59. MVP acceptance criteria

El MVP se considera funcional cuando un usuario puede completar de punta a punta:

```text
Wallet connect
    ↓
Create seller profile
    ↓
Publish service
    ↓
Buyer discovers service
    ↓
Buyer funds order with USDC
    ↓
Escrow locks funds
    ↓
Seller delivers
    ↓
Buyer approves
    ↓
Smart contract releases seller funds
    ↓
Marketplace receives fee
    ↓
Order closes
    ↓
Buyer reviews seller
```

Y además:

- el backend puede reconstruir el estado de una orden desde eventos;
- una transacción fallida no puede duplicar el pago;
- una orden no puede ser liberada dos veces;
- una orden disputada no puede ser liberada mientras la disputa esté pendiente;
- los fondos no pueden ser retirados arbitrariamente por el administrador.

---

# 60. Principales decisiones que deben mantenerse abiertas

Antes de implementación definitiva deben resolverse:

1. Nombre y branding.
2. País / entidad jurídica operadora.
3. Jurisdicciones objetivo del lanzamiento.
4. Política KYC/AML y umbrales aplicables.
5. Categorías prohibidas/restringidas.
6. Modelo exacto de disputa.
7. Duración de auto-release.
8. Take rate definitivo.
9. Política de gas sponsorship.
10. Smart account provider.
11. Servicio RPC.
12. Storage provider.
13. Estrategia de auditoría de contratos.
14. Política de reputación portable.
15. Momento adecuado para añadir Request Marketplace.

---

# 61. Visión de largo plazo

La plataforma puede evolucionar desde:

```text
Marketplace de servicios
```

a:

```text
Payment + Escrow infrastructure
```

y posteriormente a:

```text
Programmable service marketplace
```

La visión completa sería:

```text
                    GLOBAL SERVICE MARKETPLACE
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
          PEOPLE             AGENTS           BUSINESSES
             │                 │                 │
             └─────────────────┼─────────────────┘
                               │
                         SMART ORDERS
                               │
                ┌──────────────┼──────────────┐
                │              │              │
             ESCROW        MILESTONES     REPUTATION
                │              │              │
                └──────────────┼──────────────┘
                               │
                         PROGRAMMABLE PAYMENTS
                               │
                              USDC
                               │
                           BLOCKCHAIN
```

El elemento diferencial no sería “usar crypto”, sino convertir la contratación de servicios en una operación programable y verificable.

---

# 62. Recomendación de estrategia de lanzamiento

El camino más prudente es:

```text
1 blockchain
1 stablecoin
1 tipo de escrow
1 marketplace
1 modelo de fee
1 sistema de disputa
```

y demostrar primero que existe demanda real.

Después:

```text
escrow
→ milestones
→ request marketplace
→ smart accounts
→ gas sponsorship
→ reputation
→ subscriptions
→ multichain
→ agents
```

La tecnología Web3 debe utilizarse donde resuelva un problema real del marketplace: liquidación, escrow, verificabilidad, propiedad de identidad económica y automatización.

---

# 63. Resumen de arquitectura final

```text
                         ┌──────────────────────┐
                         │       USER           │
                         │  Buyer / Seller      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       FRONTEND       │
                         │ React / Next / Tail. │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
                 Wallet         Marketplace       Orders
                    │               │                │
                    └───────────────┼────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       BACKEND        │
                         │ Node / Express       │
                         └───────┬───────┬──────┘
                                 │       │
                       ┌─────────┘       └─────────┐
                       ▼                           ▼
                ┌──────────────┐          ┌─────────────────┐
                │ PostgreSQL   │          │ Blockchain RPC  │
                └──────────────┘          └────────┬────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │ Smart Escrow     │
                                          │ Solidity         │
                                          └────────┬─────────┘
                                                   │
                                                   ▼
                                                 USDC
                                                   │
                                                   ▼
                                           Seller + Fee
```

---

# 64. Decisión base del proyecto

La arquitectura objetivo queda definida conceptualmente como:

> **Marketplace internacional de servicios + USDC + wallet-native identity + non-custodial escrow + on-chain settlement + off-chain marketplace UX.**

Esta combinación permite construir primero un producto relativamente sencillo y mantener abiertas las puertas para una evolución posterior hacia reputación portable, pagos programables, multichain y agentes autónomos.

---

## Nota de alcance

Este documento es una especificación de producto y arquitectura, no asesoramiento legal ni financiero. Las decisiones de lanzamiento, custodia, pagos, KYC/AML, protección al consumidor y disponibilidad geográfica deben validarse con asesoría especializada en las jurisdicciones donde opere el producto.
