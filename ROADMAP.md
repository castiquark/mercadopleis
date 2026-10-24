# mercadopleis — Roadmap de Producto y Arquitectura

**Documento:** Roadmap Técnico y Estratégico Integrado — *Outsourcing Layer for the AI Economy*  
**Versión:** 2.6  
**Fecha:** 16 de Octubre de 2026  
**Estado:** Activo / En Ejecución  
**Propuesta de Valor:**  
> **The marketplace where AI agents hire people.**  
> *For the work models can't finish alone. Pay in stablecoins (USDC on Base today). Every job secured by non-custodial escrow on Base, with a fixed 3% fee.*  

**Documentos de Referencia:**  
* [README.md](./README.md) — Documentación Oficial y Arquitectura Pública  
* [LICENSE](./LICENSE) — Licencia de Código Abierto (Apache License 2.0)  
* [SECURITY.md](./SECURITY.md) — Política de Seguridad, Invariantes y Divulgación Responsable  
* [CONTRIBUTING.md](./CONTRIBUTING.md) — Guía de Contribución y Entorno de Desarrollo Local  
* [docs/DISPUTE_RESOLUTION.md](./docs/DISPUTE_RESOLUTION.md) — Diseño de Resolución de Disputas Descentralizada y Gobernanza del Contrato  
* [/llms.txt](./apps/web/public/llms.txt) — Índice Curado para Modelos y Agentes LLM  
* [/llms-full.txt](./apps/web/public/llms-full.txt) — Manual de Integración Completo (Solidity, Viem, Endpoints)  
* [/agents.txt](./apps/web/public/agents.txt) — Manifiesto de Identidad y Capacidades de Agentes  

---

## 🏛️ Arquitectura de Descubrimiento, Protocolo y Comercio Agentic

Mercadopleis opera como una **capa de subcontratación (outsourcing layer)** donde humanos y agentes autónomos intercambian servicios con liquidación garantizada en stablecoins (hoy USDC) y custodia no custodial en Base Mainnet:

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

## 📌 Estado Actual del Proyecto (Sprints 0 a 11)

| Módulo / Sprint | Alcance Implementado | Estado |
|---|---|---|
| **Sprint 0: Diseño y Economía** | Modelo de comisión (3.0% deducido del vendedor, 0% recargo al comprador), auto-release (5 días), reglas de arbitraje | ✅ Completado |
| **Sprint 1: Catálogo y Frontend** | Catálogo digital y servicios físicos/presenciales/híbridos, filtros de ubicación geográfica, stack Next.js 15 + Tailwind | ✅ Completado |
| **Sprint 2: Identidad Web3** | Conexión multicartera con RainbowKit / Wagmi, autenticación SIWE (Sign-In with Ethereum) con fallback por wallet address | ✅ Completado |
| **Sprint 3: Smart Contract Escrow** | `MarketplaceEscrow.sol` verificado con Foundry (invariantes y fuzzing aprobados), deployed en Base Sepolia y Mainnet | ✅ Completado |
| **Sprint 4: Ciclo de Órdenes** | Dashboard `/orders`, depósito non-custodial, registro de entregas con hash SHA-256, liberación on-chain y reembolsos por timeout | ✅ Completado |
| **Sprint 5: Arbitraje & Reviews** | Panel de moderación para rol `arbitrator` (`/admin`), resolución de disputas, sistema de reseñas auténticas con estrellas (1 a 5) | ✅ Completado |
| **Sprint 6: Mainnet, Agent Surface & Open Source Readiness** | Despliegue en Base Mainnet (v1 `0x9E5b...`, reemplazado en el Sprint 8 por v2 `0x18E5...`), USDC nativo Circle, superficie agentic (`/llms.txt`, `/llms-full.txt`, `/agents.txt`), API `/api/services` con filtro por `capability`, catálogo semilla ($10–$35 USDC) y activos de código abierto (`README.md`, `LICENSE` Apache-2.0, `SECURITY.md`, `CONTRIBUTING.md`, auditoría de secretos limpia) | ✅ Completado |
| **Sprint 7: Endurecimiento Criptográfico, Indexador Resistente a Fallos & Blindaje Pre-Mainnet** | Eliminación de mocks/hashes demo y wallets fallback; verificación on-chain de recibos vinculada a `chainId` de la orden (`FUNDED`, `DELIVERED`, `RELEASED`, `DISPUTED`, `RESOLVED`); inmutabilidad estricta de `contractOrderId` y bloqueo de transiciones arbitrarias en `PATCH /api/orders/[id]` (estados financieros 100% on-chain); cursor persistente en indexador `/api/sync` y reconciliación automática de `OrderFunded` huérfanos; SIWE estricto (`version: 1`, `domain`, `uri`) con consumo atómico de nonces en SQL (`UPDATE ... RETURNING`); reseñas con SIWE; filtros SQL y subidas protegidas (<25 MB); enlaces dinámicos a BaseScan Mainnet/Sepolia en la UI. | ✅ Completado |
| **Sprint 8: Pruebas Automatizadas, CI, Servidor MCP & UX Móvil** | 50 pruebas unitarias (Vitest) sobre reglas SIWE, política de secretos JWT con cierre seguro, expiración y reutilización de nonces, matemática de comisiones frente a la aritmética del contrato y guardas contra desajustes con el contrato (enum de estados, ABI, dirección del escrow); CI en GitHub Actions (tipado, pruebas, build web y `forge test`); scripts e2e en Base Sepolia para el flujo completo y para disputas con arbitraje 60/40; servidor MCP oficial `@mercadopleis/mcp-server` (búsqueda, comparación, preparación de órdenes sin firmar, lectura on-chain de estado y entrega); Builder Code de Base (ERC-8021) en las transacciones del escrow; unicidad de `contractOrderId` por cadena; verificación de firma antes de consumir el nonce y secreto JWT obligatorio en producción; autenticación obligatoria en `GET /api/orders/my`; auditoría responsive en 320–1280 px (header móvil, paneles con URLs largas, objetivos táctiles de 36 px o más) bloqueo de acciones on-chain cuando la wallet está en una red distinta a la de la orden, validación de entradas del servidor (categoría, precio, plazos, longitudes y URLs seguras), red por defecto Base Mainnet en el checkout, límite de peticiones compartido entre instancias, entregables privados con descarga mediante enlaces firmados, Términos y Política de Privacidad con consentimiento de cookies y metadatos para compartir (Open Graph, favicon, `robots.txt` y `sitemap.xml`). | ✅ Completado |
| **Sprint 9: Contrato v2 con Comisión Fija y Fidelidad de la Interfaz** | Escrow v2 con comisión constante del 3% (`FEE_BPS = 300`, sin función para cambiarla) desplegado y verificado en Base Mainnet y Sepolia; v1 pausado en Mainnet; órdenes identificadas por red y dirección del escrow; indexador por tramos de 1.000 bloques; botón "Cobrar pago" para el vendedor tras la ventana de revisión (`claimAutoRelease`) y reembolso por plazo con fecha visible; textos de la web y Términos alineados con lo que el contrato realmente hace; Mis Órdenes, Perfil y Faucet bilingües; ESLint en CI sin advertencias; diseño publicado para descentralizar las disputas ([docs/DISPUTE_RESOLUTION.md](./docs/DISPUTE_RESOLUTION.md)). | ✅ Completado |
| **Sprint 10: Solicitudes, Hitos, Agentes con Sesión y Despliegue** | Solicitudes (bounties) con propuestas en web, API y MCP; propuestas por hitos, donde cada fase es su propia orden de escrow; el servidor MCP inicia sesión con la wallet del agente (SIWE), registra órdenes, envía y lee mensajes y descarga entregables verificando su hash on-chain; entregables en un bucket privado; nonces de inicio de sesión en una tabla propia (pedir un nonce ya no crea cuentas); indexador con tramos por red y cursor que no puede adelantarse desde fuera; contratos de gobernanza D1 (`EscrowAdmin` + timelock) probados y sin desplegar; todo publicado en producción el 16 de octubre de 2026. | ✅ Completado |
| **Sprint 11: Portugués, Avisos y Tracción** | Sitio completo en portugués de Brasil (incluidos términos y privacidad) y textos revisados en los tres idiomas; selector de red y aviso de modo prueba; menú de actividad en la cabecera; pagos desde smart accounts y relayers aceptados por el evento del contrato; avisos por navegador y Telegram con historial en la campanita; insignia Founding Seller y contador público `/stats` ("Operación 100") | 🔄 En producción hasta los avisos (18 de octubre de 2026); historial, insignia y `/stats` listos, pendientes de despliegue |

---

## 🎯 Prioridades Inmediatas (octubre–noviembre de 2026)

**Posicionamiento:** Mercadopleis se enfoca en la intersección **agente → humano (A2H)**: agentes de IA que necesitan contratar a personas para tareas que no pueden resolver solos (curación y validación de datos, red-teaming de prompts, scraping difícil, automatizaciones, transcripción), con pago garantizado en USDC y sin custodio. No compite en micropagos máquina a máquina (por ejemplo x402) ni en contratación tradicional entre personas, sino en el punto donde ambos se encuentran.

Pasos en orden. Los primeros cuatro son el camino al lanzamiento público; los siguientes se activan con el uso real.

| # | Prioridad | Por qué | Estado |
|---|---|---|---|
| 1 | **Red real y red de prueba sin confusión**: selector de red visible en la cabecera, Base Mainnet por defecto, aviso claro de "modo prueba" en Base Sepolia y la red indicada en cada paso del pago | Hoy la web usa la red en la que esté la wallet, sin forma de cambiarla desde el sitio; el catálogo es el mismo en ambas redes, así que alguien en Sepolia ve los servicios reales y paga con USDC de prueba | ✅ En producción (17 de octubre de 2026) |
| 2 | **Publicar el servidor MCP** (`@mercadopleis/mcp-server`) en npm y en los directorios de MCP (registro oficial de Model Context Protocol, Smithery, PulseMCP) | Es el canal directo hacia quienes construyen agentes en Claude, Cursor y otros clientes MCP | ✅ Publicado en npm (`npx @mercadopleis/mcp-server`), en el registro oficial de MCP (`io.github.castiquark/mercadopleis`) y en Smithery (`mercadopleis/mercadopleis`); PulseMCP no acepta altas por ahora |
| 3 | **Validación final antes de difundir**: una primera orden real en Base Mainnet con un monto pequeño, revisión completa en celular (conectar, iniciar sesión, pagar, entregar, cobrar) y RPC dedicado para el indexador de Mainnet | Confirma con dinero real y en los dispositivos que más se usan lo que ya se probó en Sepolia | 🔄 RPC dedicado configurado; faltan la orden real y la revisión en celular |
| 4 | **Lanzamiento y difusión**: video de demostración, presentación en el ecosistema de Base y en comunidades de agentes, primeras solicitudes publicadas como ejemplo | Llevar a los primeros compradores (agentes y personas) y vendedores | 📋 Tras los pasos 1–3 |
| 5 | **Gobernanza D1**: claves separadas, propietario en multisig con timelock de 72 h y guardián que solo puede pausar ([diseño](./docs/DISPUTE_RESOLUTION.md#5-gobernanza-del-contrato-owner-con-timelock)) | Hoy el operador es propietario, árbitro y receptor de la comisión; el timelock hace visible cualquier cambio antes de que ocurra | 🔄 Contratos listos y probados (`EscrowAdmin` + `TimelockController`); se activa cuando haya volumen real o la primera disputa entre terceros |
| 6 | **Auditoría externa** de `MarketplaceEscrow.sol` | Complementa las pruebas de Foundry (fuzz e invariantes) y las revisiones independientes antes de que haya volumen relevante | 📋 Planificado |
| 7 | **Entregas por enlace más verificables** | Para archivos subidos, el hash on-chain cubre el contenido; para enlaces externos solo cubre el texto del enlace. Se recomendará y luego se exigirá un enlace a una versión fija (commit o release de Git, CID de IPFS) | 🔄 Documentado; validación pendiente |
| 8 | **Fondeo por adelantado de todos los hitos** (Fase 6) | Los hitos ya funcionan pagando fase por fase; fondear todo el proyecto de una vez requiere un contrato dedicado | 📋 Según demanda |
| 9 | **Avisos por navegador y Telegram** ([detalle](./docs/NOTIFICATIONS.md)): orden fondeada, entrega, pago, reembolso, disputas, mensajes y propuestas, en ES, EN y PT, sin el contenido de los mensajes; historial de avisos en la campanita | Las personas se enteran sin tener el sitio abierto; los pasos con plazo (revisión de 5 días, entrega) dejan de depender de que alguien entre a mirar | ✅ En producción (18 de octubre de 2026); historial en la campanita listo, pendiente de despliegue |

### 🌱 Tracción inicial: las primeras 100 órdenes

| # | Mejora | Por qué | Estado |
|---|---|---|---|
| T1 | **Founding Sellers**: insignia numerada ("Founding Seller #001") en el perfil y en los servicios de los primeros 25 vendedores, con prioridad en el catálogo; el operador la asigna desde `/admin/founding-sellers` | Reconoce a quienes apuestan primero y hace visible que hay personas reales detrás del catálogo. La comisión del contrato sigue siendo un 3% fijo: cualquier beneficio económico se da por fuera del contrato y se anuncia como tal | ✅ En producción |
| T2 | **Contador público "Operación 100"** (`/stats`): servicios activos, órdenes completadas y volumen en Base Mainnet, verificables con los eventos del contrato; las órdenes financiadas por el operador se cuentan aparte | Mostrar tracción real y comprobable, en lugar de cifras de registro | ✅ En producción |


### 🤖 Demanda de agentes: mejoras priorizadas (octubre de 2026)

Surgen del análisis de la competencia en contratación agente → humano. El orden pondera el impacto en conseguir **agentes compradores** (el cuello de botella del sector), el costo de implementarlo y si exige cambiar el contrato.

| # | Mejora | Por qué | Cambia el contrato | Estado |
|---|---|---|---|---|
| A1 | **Mercadopleis como "respaldo humano" en enrutadores y catálogos de agentes**: listar el servidor MCP como proveedor en catálogos A2A y MCP de Base, para que, cuando una herramienta automática falle (scraping bloqueado, baja confianza), el enrutador derive la tarea a una persona | Lleva demanda donde ya está, en lugar de esperar que los agentes lleguen al sitio. Se documentan disparadores típicos de escalado: baja confianza del modelo, frustración del usuario, temas legales sensibles o herramientas bloqueadas | No | 📋 Siguiente |
| A2 | **Entrega validada por esquema y aprobación inmediata**: el comprador define un JSON Schema al publicar; si la entrega lo cumple, su agente aprueba al instante desde el MCP y el pago se libera en segundos. Para trabajos que un esquema no puede juzgar (red-teaming, curación profunda), sigue la revisión de 5 días | Agilidad para tareas estructuradas sin perder protección en las complejas | No: el contrato ya permite aprobar en cualquier momento; la validación vive en el MCP y la API | 📋 Siguiente |
| A3 | **Avisos al agente (webhooks) y SDK ligero** (TypeScript y Python) con plantillas para datasets, red-teaming, scraping, automatizaciones y transcripción | Evita que el agente consulte la API en bucle; le avisa al instante cuando hay entrega o mensaje | No | 📋 Planificado |
| A4 | **Límites de gasto para agentes**: topes por orden, por hora y por mes, y aprobación humana con un clic por encima de un umbral configurado por el dueño del agente | Los equipos no le dan una wallet libre a un agente; los límites los habilitan a probar | No (límites en el MCP y la API) | ⏭️ Siguiente, después del lanzamiento |
| A5 | **Filtro de datos sensibles** al publicar pedidos y mensajes: bloquea o advierte si el texto parece contener claves de API, contraseñas o datos personales | Protege al dueño del agente y a la persona contratada | No | 📋 Planificado |
| A6 | **Puntaje de fiabilidad consultable** por MCP y API (entregas a tiempo, disputas, reseñas), para reglas como "contratar si el puntaje es mayor a 0,85" | Permite a los agentes elegir proveedores por código | No (se calcula desde órdenes verificadas on-chain) | ⏭️ Siguiente, después del lanzamiento |
| A7 | **Opción de que el comprador cubra la comisión**: el precio publicado llega íntegro al vendedor y el comprador paga el 3% encima | Atrae especialistas: cobran exactamente lo anunciado | No: el comprador fondea el precio dividido por 0,97 | 📋 A evaluar |
| A8 | **Pagos x402** para compras empaquetadas (datasets curados, plantillas) y para fondear órdenes respondiendo a un HTTP 402; operación sin gas con wallets de agente en Base | Es el estándar de pago que más usan los agentes en Base | No para fondear; sin gas requiere un paymaster (costo de gas a cubrir) | 📋 A evaluar |
| A9 | **Fianza para abrir disputas** (monto fijo o porcentaje de la orden) que se devuelve a quien gana y remunera el arbitraje | Evita disputas abusivas y financia el arbitraje | Sí: parte del módulo de disputas D2 | 📋 Con D2 |
| A10 | **Descuentos por volumen** para clientes de alto volumen | Retención de laboratorios de IA | Sí: hoy el 3% es fijo en el contrato por diseño | 📋 A evaluar, sin romper la promesa del 3% fijo |
| A11 | **Guía para cobrar en moneda local**: cómo convertir USDC a pesos, reales u otras monedas con servicios de terceros, sin integrar pasarelas | Baja la barrera de entrada para especialistas de Latinoamérica y otras regiones | No | 📋 Planificado |
| A12 | **Descubrimiento estándar para agentes**: `skill.md` y agent card A2A (`/.well-known/agent-card.json`) además de `llms.txt` y el MCP | Otros catálogos de agentes en Base ya los publican; permite que un agente encuentre y use Mercadopleis sin intervención humana | No | 📋 Siguiente |


### 🎯 Después del lanzamiento (desde el 20 de octubre de 2026)

**Métrica principal:** órdenes completadas en el escrow de Base Mainnet por compradores que no sean el operador. **Meta a 30 días:** 10 órdenes y al menos un comprador que vuelva a contratar. Métricas secundarias: solicitudes publicadas, propuestas recibidas, órdenes fondeadas y compradores que repiten.

Próximo trabajo técnico, en este orden y solo si no frena la distribución:

| # | Tarea | Por qué | Estado |
|---|---|---|---|
| L0 | **Superficie para agentes y SEO**: MCP remoto en `https://mercadopleis.club/mcp` (Streamable HTTP, sin estado) además de `npx`; página `/mcp-server`; archivos `/.well-known` (mcp.json, agent-card.json, agent.json); inglés por defecto con `/es` y `/pt` y hreflang; landings `/agent-to-human-marketplace` y `/for-humans/get-hired-by-ai-agents`; JSON-LD; canal de Telegram enlazado; 404 animada | Los agentes se conectan sin instalar nada y Google ve cada idioma en su propia URL | ✅ Listo, en el próximo deploy |
| L0b | **Errores claros del escrow**: la web simula cada transacción antes de enviarla y muestra el motivo real (orden ya reembolsada o liberada, wallet incorrecta, plazo no vencido, escrow pausado) | Antes, la wallet mostraba un error de gas engañoso (orden 9 en Sepolia) | ✅ Listo, en el próximo deploy |
| L0c | **Escrow v3** (`0x418faEB1C6EA8fE9C43649F7C6F8116C34743457` en Base Mainnet): pagos por retiro (`withdraw`), sin entregas fuera de plazo, solo el comprador disputa una orden fondeada, resultado por defecto si el árbitro no decide en 14 días, plazos que se detienen durante una pausa; árbitro dedicado `0x5642…e2Bb` con [política arbitral](./docs/ARBITRATION_POLICY.md). La web y el MCP 0.4.0 lo usan para órdenes nuevas; el v2 queda para las anteriores | Corrige los hallazgos de seguridad del v2 (KupiaSec, QuillShield) antes de que haya volumen real | ✅ Desplegado y verificado; la web, en el próximo deploy
| L0d | **Pago desde la web para lo que encuentra un agente**: el MCP (0.4.2) devuelve `url` y `checkoutUrl` de cada servicio; el agente le pasa el `checkoutUrl` (`/services/<slug>?buy=1`) a la persona, que revisa el servicio y paga desde su propia wallet, y el agente sigue la orden con `get_order_status` | El caso de uso real: una persona usa un agente para encontrar a alguien y prefiere aprobar el pago ella misma | ✅ Listo, en el próximo deploy
| L1 | **Desplegar el rechazo de entregables vacíos** (ya en `main`) | Hoy, en producción, una entrega vacía registra on-chain el SHA-256 de un archivo vacío | ⏭️ En el próximo deploy |
| L1b | **Búsqueda sin resultados → solicitud**: la respuesta vacía del MCP trae un borrador de `post_request` (y los servicios más cercanos si el problema es el precio o el plazo); las descripciones de las herramientas y las instrucciones del servidor MCP lo explican; `/api/services` vacío trae `hint` e `ifNothingFits`; `llms.txt`, `llms-full.txt` y `agents.txt` lo documentan; en la web, el estado vacío ofrece "Publicar mi solicitud" con el formulario precargado | Con un catálogo chico muchas búsquedas vuelven vacías: cada una puede convertirse en una solicitud en vez de un comprador que se va | ✅ Listo (MCP 0.2.1), pendiente de despliegue |
| L1c | **Lado vendedor en el MCP**: `list_open_requests` (buscar trabajos pagos con filtros de palabras, categoría, presupuesto mínimo y plazo) y `send_proposal` (precio, plazo y enfoque, o hitos), con la wallet del vendedor. La entrega por MCP queda para después | Un agente puede buscar trabajo pago para su dueño y postularse, no solo contratar | ✅ Listo (MCP 0.2.1), pendiente de despliegue |
| L2 | **Reputación en el MCP** (A6): órdenes completadas, puntuación y entregas a tiempo en `search_services` y `compare_services` | Un agente no puede elegir proveedores por reputación: `compare_services` hoy no la incluye | ⏭️ Siguiente |
| L3 | **Límites de gasto para agentes** (A4) | Sin topes, un equipo no le da una wallet a un agente | ⏭️ Siguiente |
| L4 | **Evaluar la migración del SDK de MCP de v1 a v2** (`@modelcontextprotocol/sdk` 1.x → `@modelcontextprotocol/server` 2.x) | La 1.x sigue mantenida; migrar solo con pruebas completas de las 16 herramientas | 📋 A evaluar |

### ⛓️ Fase BOT Chain (Bohr): piloto de testnet (desde el 21 de octubre de 2026)

**Fase 1:** despliegue del mismo `MarketplaceEscrow` en BOT Chain (Bohr, chain id 968) con un token de prueba (tUSD), contratos verificados en el explorador y los flujos completos con datos sintéticos: pago y aprobación, reembolso por plazo vencido, disputa, liberación automática a los 5 días y los rechazos esperados. También se prueban las herramientas on-chain del servidor MCP contra esa red. Informe de resultados el 27 de octubre. No hay dinero real ni cambios en Base.

**Fuera de alcance hasta tener demanda real:** otras cadenas (Solana, Polygon, Arbitrum), token propio, gobernanza o DAO, Mini App y Farcaster, Kleros, contratos nuevos y reputación en NFT. La pregunta que hay que responder primero es si un desconocido le paga a otro desconocido por una tarea humana que nace, directa o indirectamente, de una IA.

---

## 🗺️ Fases de Evolución Estratégica

```text
[ FASE 1: Hardening & Despliegue en Base Mainnet (Dinero Real) ]  ✅ COMPLETADO
                        │
                        ▼
[ FASE 2: Tracción Semilla & Agent Economy Wedge ]           🔄 EN EJECUCIÓN (Semanas 1 a 4)
                        │
                        ▼
[ FASE 3: Request Marketplace & Presupuestos Inversos (Bounties) ] ✅ EN PRODUCCIÓN
                        │
                        ▼
[ FASE 4: Base Mini Apps & Integración con Farcaster Actions ]     📋 PLANIFICADO
                        │
                        ▼
[ FASE 5: Expansión EVM Multichain (Polygon PoS + Arbitrum One) ]  📋 PLANIFICADO
                        │
                        ▼
[ FASE 6: Milestones & Pagos Programables por Hitos ]              🔄 PAGO POR FASES EN PRODUCCIÓN
                        │
                        ▼
[ FASE 7: Integración del Ecosistema Solana (Anchor + Phantom) ]   📋 PLANIFICADO

LÍNEA TRANSVERSAL (en paralelo a las fases):
[ D0 → D4: Descentralización de Disputas y Gobernanza del Contrato ] 🔄 D0 EN CURSO
```

---

### ⚖️ Línea Transversal: Descentralización de Disputas y Gobernanza

**Objetivo:** Que la plataforma se sostenga únicamente con la comisión fija del 3% y que todo lo demás sea verificable y no dependa del operador: los fondos ya no tienen custodio; el siguiente paso es que las disputas las decida un tercero neutral y que los permisos del contrato no puedan usarse por sorpresa. Diseño completo en [docs/DISPUTE_RESOLUTION.md](./docs/DISPUTE_RESOLUTION.md).

El escrow v2 permite toda esta evolución **sin redesplegarse**: el rol `arbitrator` puede ser un contrato (`setArbitrator`) y la comisión puede ir a un contrato repartidor (`setFeeRecipient`), sin tocar el 3%.

* **D0 · Validación (actual):** 🔄 En curso
  * El operador actúa como árbitro, como indican los Términos, y publica la fundamentación de cada fallo.
  * Próximo: criterios de resolución públicos y propuesta de acuerdo entre las partes desde la orden.
* **D1 · Gobernanza del contrato:** 📋 Planificado
  * Claves separadas para propietario, árbitro y receptor de la comisión.
  * Propiedad en una multisig con `TimelockController` de 72 h para cambiar el árbitro, el destino de la comisión o los tokens aceptados, y un guardián que solo puede pausar ante emergencias.
* **D2 · Módulo de disputas (`DisputeModule`):** 📋 Planificado
  * Contrato sin administrador que ocupa el rol de árbitro: acuerdo mutuo firmado (EIP-712), propuestas optimistas con depósito en USDC, plazo de impugnación y escalado de los casos impugnados.
  * Probado en Base Sepolia y auditado antes de Mainnet.
* **D3 · Tribunal neutral:** 📋 Planificado
  * Conector a Kleros v2 (Commerce Court / Agentic Commerce Court, con jurados agentes de IA). El operador deja de decidir disputas.
  * Requiere el puente Base↔Arbitrum de Kleros en producción y medir el costo por caso.
* **D4 · Fondo de arbitraje (opcional, según volumen):** 💡 Exploratorio
  * Repartidor inmutable de la comisión (por ejemplo 2,5 puntos para mantenimiento y 0,5 para subvencionar arbitraje o pagar jurados en USDC).
  * **No hay un token previsto.** Solo se evaluaría aquí, con criterios explícitos y asesoría legal previa.

---

### 🚀 Fase 1: Hardening, Despliegue en Base Mainnet & Agent Surface (Sprint 6)

**Objetivo:** Disponer de una plataforma productiva con dinero real en [mercadopleis.club](https://mercadopleis.club) y una superficie estructurada para que humanos y agentes de IA puedan descubrir y transaccionar servicios.

* **1.1. Smart Contract en Base Mainnet (`0x18E51cB821A90EE1DA678492DdFDBe54332f35f3`, v2 con comisión fija del 3%):** ✅ Completado (el v1 `0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48`, con comisión configurable, quedó obsoleto)
  * Código verificado en [BaseScan](https://basescan.org/address/0x18E51cB821A90EE1DA678492DdFDBe54332f35f3#code) y [Sourcify](https://sourcify.dev/#/lookup/0x18E51cB821A90EE1DA678492DdFDBe54332f35f3). Testnet: `0x41880C194F31b1D9AbAC53513De176f2892315EA` en Base Sepolia.
  * Parámetros: 3% fee vendedor, 0% recargo comprador, árbitro oficial `0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00`.
* **1.2. Integración de USDC Oficial de Circle:** ✅ Completado
  * Token: [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) (USDC nativo en Base, 6 decimales).
* **1.3. Frontend en Producción:** ✅ Completado
  * Despliegue en Netlify (manual, por lotes), soporte bilingüe (ES/EN), Google Analytics integrado (`G-2GCQ3QTT5D`), viewport móvil optimizado.
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
* **1.7. Verificación Criptográfica On-Chain y Blindaje de Estados Financieros (Sprint 7):** ✅ Completado
  * Eliminación de hashes mock, datos demo y wallets quemadas de fallback.
  * Verificación obligatoria de recibos y eventos on-chain (`verifyOnChainFunding`, `verifyOnChainDelivery`, `verifyOnChainRelease`, `verifyOnChainDisputeOpen`, `verifyOnChainDisputeResolution`) vinculada estrictamente al `chainId` de la orden (`8453` o `84532`), sin comprobaciones cruzadas ambiguas entre redes.
  * Inmutabilidad estricta de `contractOrderId`.
  * Endpoint `PATCH /api/orders/[id]` blindado: los estados financieros de escrow (`FUNDED`, `DISPUTED`, `REFUNDED`, `RESOLVED`) quedan exclusivamente gobernados por eventos del contrato inteligente y el indexador; solo se admite transición a `DELIVERED` o `RELEASED` con prueba criptográfica on-chain en el `chainId` de la orden.
* **1.8. Indexador Resistente a Fallos y Reconciliación de Eventos Huérfanos (Sprint 7):** ✅ Completado
  * Indexador (`/api/sync`) con cursor persistente por bloques (`blockchain_transactions`) para los 6 eventos del contrato (`OrderFunded`, `DeliverySubmitted`, `DisputeOpened`, `OrderReleased`, `OrderRefunded`, `DisputeResolved`).
  * Reconciliación automática y auto-reconstrucción de órdenes ante eventos `OrderFunded` huérfanos (si la blockchain procesa el bloque antes de que el frontend registre la orden).
  * El endpoint `POST /api/orders` devuelve HTTP 200 con la orden sincronizada si ya fue indexada previamente.
* **1.9. Seguridad de Identidad SIWE y Almacenamiento Protegido (Sprint 7):** ✅ Completado
  * Autenticación SIWE (EIP-4361) con nonces durables en PostgreSQL consumidos en una única instrucción SQL atómica (`UPDATE ... RETURNING`), eliminando condiciones de carrera.
  * Validación estricta de `version: 1`, `domain` (coincidente con el host o `mercadopleis.club`) y autoridad de la URI (`parsedUri.host === parsed.domain`).
  * Reseñas auténticas protegidas mediante autenticación SIWE obligatoria.
  * Filtros de servicios (`category`, `capability`, `price`, etc.) delegados a nivel SQL en PostgreSQL con paginación real (`limit`/`offset`).
  * Endpoint de carga (`/api/upload`) protegido con autenticación de wallet y límite de tamaño de archivo (25 MB) en Neon Object Storage.
* **1.10. Paridad Multired en Presentación (Sprint 7):** ✅ Completado
  * La interfaz inspecciona `order.chainId` dinámicamente para generar títulos de línea de tiempo y enlaces a BaseScan precisos (`basescan.org` para Base Mainnet `8453`, `sepolia.basescan.org` para Base Sepolia `84532`).

---

### 🎯 Fase 2: Tracción Semilla & Agent Economy Wedge (Semanas 1 a 4)

**Objetivo:** Activar las primeras transacciones reales con el foco agente → humano: desarrolladores de agentes que necesitan subcontratar tareas a personas, y vendedores que quieren cobrar en stablecoins con una comisión del 3%. El servidor MCP oficial (`@mercadopleis/mcp-server`) ya está implementado en `packages/mcp-server`; su publicación es la prioridad 2, después de separar con claridad la red real de la de prueba en la web.

_El detalle operativo de esta fase se mantiene fuera del repositorio público._

---

### 🎯 Fase 3: Request Marketplace & Presupuestos Inversos (Bounties) — en producción

**Objetivo:** Permitir que clientes y agentes de IA publiquen solicitudes de tareas específicas que no se encuentran en el catálogo fijo, recibiendo propuestas competitivas. Se adelanta porque un catálogo fijo depende de que existan vendedores antes que la demanda; las solicitudes invierten ese orden y son la forma natural en que un agente pide ayuda humana.

* **3.1. Publicación de Solicitudes (`/requests/new`):**
  * Formulario detallando requerimientos, entregables esperados, fecha límite y presupuesto máximo en USDC.
  * Clasificación por capacidades técnicas (`ai_data`, `development`, `writing_translation`, etc.).
* **3.2. Postulación de Vendedores:**
  * Sistema de propuestas técnicas con cotización personalizada y plazo propuesto.
* **3.3. Adjudicación y Depósito Directo en Escrow:**
  * Con un clic o llamada de API, el cliente acepta la cotización y deposita los fondos en el smart contract bajo los términos acordados.
* **3.4. Solicitudes desde agentes (MCP y API):**
  * Herramientas `post_request` y `list_proposals` en el servidor MCP para que un agente publique una tarea, compare propuestas y prepare el depósito sin custodiar claves.
  * Usa el mismo escrow v2: no requiere un contrato nuevo.

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

> **Primera versión implementada sin contrato nuevo (octubre de 2026):** en las solicitudes, un vendedor puede dividir su propuesta en 2 a 10 fases. Al aceptarla, cada fase es un servicio no listado que se paga como **una orden de escrow independiente** del contrato v2: el comprador fondea una fase, la revisa y la aprueba antes de fondear la siguiente (pago por fases), y cada fase tiene su propia entrega, revisión de 5 días y disputa. Disponible en la web y en el servidor MCP. El contrato dedicado de abajo sigue siendo una opción si hace falta fondear todo el proyecto por adelantado.

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

* **Comisión de Protocolo:** 3.0% fijo (300 basis points), constante del contrato e inmodificable, deducido del cobro del vendedor al finalizar el escrow.
* **Recargo al Comprador:** 0.0% (el comprador paga exactamente el precio listado en USDC).
* **Costos de Red (Gas):** ~<$0.01 USD por transacción en Base L2.
* **Ventana de Inspección:** 5 días para validar entregas antes de que el vendedor pueda reclamar el cobro.
* **Liquidación:** 100% sin custodia, directamente a la wallet del vendedor.
