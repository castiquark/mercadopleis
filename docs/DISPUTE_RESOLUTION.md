# Resolución de disputas y gobernanza: diseño hacia la descentralización

**Estado:** propuesta de diseño (no implementada)  
**Fecha:** 3 de octubre de 2026  
**Alcance:** cómo se deciden las disputas del escrow, quién controla los permisos del contrato y cómo se financia la plataforma, desde la etapa actual hasta una resolución sin operador central.  
**Relacionado:** [ROADMAP.md](../ROADMAP.md) · [SECURITY.md](../SECURITY.md) · [`MarketplaceEscrow.sol`](../contracts/src/MarketplaceEscrow.sol)

---

## 1. Objetivo

1. **La plataforma se sostiene solo con la comisión fija del 3%** que cobra el contrato al vendedor. No hay otras fuentes de ingreso previstas.
2. **Nadie custodia fondos.** Esto ya se cumple: el dinero solo se mueve según las reglas del contrato.
3. **Las disputas las decide un tercero neutral**, no el operador de la plataforma, que hoy es árbitro y a la vez recibe la comisión.
4. **Los permisos de administración no pueden usarse por sorpresa.** Cualquier cambio sensible se anuncia on-chain con antelación.

Este documento es público para que usuarios, agentes y colaboradores sepan hacia dónde va el protocolo y puedan opinar antes de que se implemente.

---

## 2. Punto de partida: qué permite el contrato v2

El escrow desplegado (`0x18E51cB821A90EE1DA678492DdFDBe54332f35f3` en Base Mainnet) es inmutable, pero ya tiene lo necesario para evolucionar sin redesplegarlo:

| Hecho del contrato | Consecuencia para el diseño |
|---|---|
| `openDispute(orderId)`: comprador o vendedor, con la orden fondeada o entregada. Abrirla es gratis. | Cualquiera de las partes puede congelar los fondos sin costo. El diseño tiene que desincentivar disputas abusivas. |
| `resolveDispute(orderId, sellerAmount, buyerRefund)` solo lo puede llamar `arbitrator`. La suma debe ser igual al monto de la orden. El 3% se cobra solo sobre `sellerAmount`. | El árbitro **puede ser un contrato**. Un contrato adaptador puede tener ese rol y ejecutar lo que decidan las partes, un mecanismo optimista o un tribunal externo. |
| `arbitrator` es **uno solo para todas las órdenes**, incluidas las que están en curso, y lo cambia el propietario con `setArbitrator`. | Hoy el propietario podría cambiar al árbitro en medio de una disputa. Hay que limitarlo con un timelock (sección 5). |
| `setFeeRecipient` cambia el destino de la comisión. La tasa (`FEE_BPS = 300`) es constante. | La comisión puede ir a un contrato que la reparta, por ejemplo mantenimiento y fondo de arbitraje, sin tocar el 3%. |
| Una disputa abierta no tiene plazo: los fondos quedan bloqueados hasta que el árbitro resuelve. | El adaptador necesita reglas de plazo para que ninguna disputa quede abierta para siempre (sección 4.4). |
| `pause()` bloquea todas las operaciones de usuarios, pero no `resolveDispute`. | Las disputas se pueden seguir resolviendo durante una pausa de emergencia. |

---

## 3. Alternativas evaluadas

### 3.1 Tribunal descentralizado existente: Kleros

- **Cómo funciona.** Jurados que bloquean tokens PNK como garantía votan en secreto y se les recompensa si votan con la mayoría (punto de Schelling). Las decisiones se pueden apelar con más jurados. La versión 2 corre en Arbitrum One y se integra implementando `IArbitrableV2.rule(disputeID, ruling)`. El costo de arbitraje es la tarifa por jurado multiplicada por el número de jurados, pagadera en ETH o en un ERC-20.
- **Encaje con Mercadopleis.** En agosto de 2026 Kleros creó un *Agentic Commerce Court* (corte 34 en Arbitrum One, hija de la Commerce Court) cuyos jurados son agentes de IA. Entre el 19 de agosto y el 25 de septiembre de 2026 resolvió 129 disputas en una sola ronda, con votos en segundos.
- **A favor.** Neutralidad real, un grupo de jurados ya existente, apelaciones y ningún token propio.
- **En contra o pendiente.**
  - El escrow está en Base y la corte en Arbitrum: hace falta un puente entre redes. Kleros trabaja en rutas de Vea para Base, pero hay que confirmar que estén en producción.
  - El costo por disputa puede superar el valor de órdenes pequeñas (hoy el catálogo va de 10 a 35 USDC). Hay que medirlo.

### 3.2 Resolución optimista con depósitos (modelo UMA / Reality.eth)

- **Cómo funciona.** Alguien propone un resultado y deja un depósito. Si nadie lo impugna dentro del plazo, el resultado se da por bueno. Si alguien lo impugna con otro depósito, se escala a un tribunal.
- **A favor.** La mayoría de los casos se cierran sin jurado y casi sin costo, y el diseño es simple y auditable.
- **En contra.** Necesita un tribunal final para los casos impugnados. Además, si ese tribunal final es una votación de poseedores de un token, se puede concentrar el poder: según una investigación del Wall Street Journal, en la mayoría de las disputas de Polymarket resueltas por UMA más de la mitad de los votos vino de las diez wallets más grandes.

### 3.3 Jurado propio de usuarios

- **Cómo funciona.** Usuarios con garantía depositada son elegidos al azar (por ejemplo, con Chainlink VRF), votan con compromiso y revelación (*commit-reveal*) y cobran por caso.
- **A favor.** Control total del diseño y la posibilidad de recompensar a la comunidad con parte de la comisión.
- **En contra.**
  - Con pocas disputas, el grupo de jurados es pequeño y fácil de capturar.
  - Es un contrato nuevo, complejo y con fondos en juego, que necesita una auditoría externa.
  - Supone operar un sistema de reputación de jurados.

  Solo tiene sentido con volumen alto.

### 3.4 ¿Un token propio?

**No está previsto.**

- **Riesgo regulatorio.** Un token que da derecho a una parte de los ingresos de la plataforma se parece a un valor financiero, porque es una expectativa de ganancia por el trabajo de otros. Crearlo exige asesoramiento legal en cada jurisdicción relevante.
- **No hace falta.** Las garantías y las recompensas de jurados pueden ser en USDC: más estables, más simples de entender y sin mercado propio que mantener.
- **Agrega problemas propios.** Liquidez, precio, concentración de poder (ver 3.2) y trabajo de comunidad.

Solo se volvería a evaluar en la etapa D4 (sección 6), con criterios explícitos y asesoría legal previa.

---

## 4. Diseño propuesto: módulo de disputas como árbitro

Un contrato nuevo, **`DisputeModule`**, sin administrador ni funciones de actualización, ocupa el rol `arbitrator` del escrow. No custodia los fondos de la orden, que siguen en el escrow; solo maneja los depósitos de las propuestas.

```text
                 escrow.openDispute(orderId)      (comprador o vendedor, sin cambios)
                              │
                              ▼
   ┌─────────────────── DisputeModule (arbitrator) ───────────────────┐
   │ 1. Acuerdo mutuo      ambas partes firman el reparto (EIP-712)  ─┼─► escrow.resolveDispute
   │ 2. Propuesta          una parte propone y deposita; plazo T     ─┼─► sin impugnación: se ejecuta
   │ 3. Impugnación        la otra parte deposita lo mismo           ─┼─► escalado al tribunal
   │ 4. Tribunal           conector: Safe del operador (D2) o Kleros (D3)
   │                        el fallo se ejecuta; el perdedor pierde su depósito
   └──────────────────────────────────────────────────────────────────┘
```

### 4.1 Acuerdo mutuo (camino feliz)

- Comprador y vendedor firman un mensaje EIP-712 `Settlement(escrow, chainId, orderId, sellerAmount, buyerRefund, deadline)`.
- Cualquiera puede enviarlo, por ejemplo la web. El módulo verifica que la orden esté en disputa, que firmen exactamente su comprador y su vendedor (leídos de `escrow.orders(orderId)`), que el reparto sume el monto y que no haya vencido. Luego llama a `resolveDispute`.
- Sin depósitos ni costo de arbitraje. La web ofrecerá **"proponer un acuerdo"** en la propia orden.

### 4.2 Propuesta optimista

- Si no hay acuerdo, cualquiera de las dos partes propone un reparto y deposita `bond` USDC.
- Si en el plazo `T` la otra parte no la impugna, cualquiera puede ejecutarla: se llama a `resolveDispute` y se devuelve el depósito.
- Mientras corre el plazo, las partes todavía pueden reemplazarla por un acuerdo mutuo (4.1); en ese caso se devuelve el depósito.

### 4.3 Impugnación y tribunal

- La otra parte impugna depositando el mismo `bond`. El caso pasa al **conector de tribunal**, una interfaz con dos implementaciones previstas:
  - **D2 (transitoria):** una Safe multisig del operador decide solo los casos impugnados, con una justificación pública.
  - **D3:** Kleros v2, con el tribunal y la política de la corte fijados en el despliegue del conector.
- Cuando llega el fallo, el módulo ejecuta `resolveDispute`. El depósito del perdedor cubre el costo de arbitraje y el resto va al ganador. La parte que escala adelanta el costo del tribunal y lo recupera si gana.

### 4.4 Plazos para que ninguna disputa quede abierta para siempre

| Situación | Regla propuesta |
|---|---|
| Pasan `P` días desde que la disputa se registra en el módulo (un contrato no puede leer la fecha de un evento pasado, así que cualquiera la registra al abrirla) sin ninguna propuesta | Las propuestas nuevas usan un plazo de impugnación corto (24 horas), para que la parte interesada pueda cerrar el caso si la otra abandonó. |
| El tribunal no responde en `C` días (por ejemplo, un fallo del puente entre redes) | Se devuelven los depósitos y el caso vuelve al paso 4.2. Como respaldo, el propietario puede volver a apuntar el árbitro (con timelock, sección 5). |

### 4.5 Parámetros iniciales (a calibrar en Sepolia)

| Parámetro | Valor inicial | Motivo |
|---|---|---|
| `bond` | máximo entre el 10% del monto y 2 USDC | Encarece las propuestas abusivas sin bloquear órdenes pequeñas. |
| `T` (plazo de impugnación) | 72 horas | Tiempo suficiente para que una persona responda; un agente responde en segundos. |
| `P` (inactividad) | 14 días | Evita fondos bloqueados indefinidamente. |
| Umbral para escalar a Kleros | según el costo medido | Por debajo del umbral, el caso lo decide la corte de agentes o el conector de D2. |

### 4.6 Seguridad

- **Sin administrador ni actualización** en `DisputeModule`. Para cambiar reglas se despliega un módulo nuevo y se apunta el árbitro a él, siempre con el timelock de la sección 5.
- **Firmas sin reutilización:** dominio EIP-712 con escrow, `chainId`, `orderId` y fecha de vencimiento.
- **Patrón checks-effects-interactions** y `nonReentrant` en las ejecuciones; los depósitos se mueven con `SafeERC20`.
- **Pruebas de propiedades (fuzz/invariantes):** el módulo nunca retiene USDC de órdenes; la suma de los depósitos que custodia coincide con su saldo; y cada disputa se ejecuta como máximo una vez.
- **Auditoría externa** antes de usarlo en Mainnet.

---

## 5. Gobernanza del contrato: owner con timelock

Hoy una sola wallet es propietaria del contrato, árbitro y receptora de la comisión, como dicen los Términos. El objetivo:

| Acción | Quién | Con qué demora |
|---|---|---|
| `pause()` | Una multisig "guardián" | Inmediata: es la acción de emergencia. |
| `unpause()`, `setArbitrator`, `setFeeRecipient`, `setAcceptedToken`, transferir la propiedad | Multisig a través de un `TimelockController` (OpenZeppelin) | 72 horas, visibles on-chain antes de ejecutarse. |

Como `Ownable2Step` admite un solo propietario, la propiedad pasará a un pequeño contrato intermediario que solo permite `pause()` al guardián y envía todo lo demás al timelock. **Implementado** en [`contracts/src/EscrowAdmin.sol`](../contracts/src/EscrowAdmin.sol), con 15 pruebas en Foundry y el script [`DeployEscrowAdmin.s.sol`](../contracts/script/DeployEscrowAdmin.s.sol), ensayado sobre una copia local de Base Sepolia. Falta desplegarlo en Mainnet con la multisig y el guardián definitivos. Así nadie puede cambiar el árbitro o el destino de la comisión sin aviso, y los usuarios con órdenes abiertas tienen tiempo de reaccionar.

**No se renunciará a la propiedad.** Si el contrato quedara sin propietario, no se podría reemplazar un árbitro defectuoso ni hacer una pausa de emergencia.

---

## 6. Hoja de ruta por etapas

| Etapa | Contenido | Condición para avanzar |
|---|---|---|
| **D0 · Validación (actual)** | El operador es el árbitro, como dicen los Términos. Criterios de resolución publicados. Fundamentación escrita en cada fallo (ya existe en la web). Acuerdo entre las partes propuesto desde la web y ejecutado por el operador. | Primeras órdenes reales. |
| **D1 · Gobernanza** | Separación de claves: propietario, árbitro y receptor de la comisión distintos. Propiedad en multisig con timelock y guardián de pausa (sección 5). | Fondos en escrow por encima de lo que el operador asumiría perder, o primera disputa entre terceros. |
| **D2 · Módulo de disputas** | `DisputeModule` desplegado y auditado: acuerdo mutuo, propuestas optimistas con depósito, y los casos impugnados decididos por la multisig del operador. | Módulo probado en Sepolia con casos reales de prueba y auditado. |
| **D3 · Tribunal neutral** | Conector a Kleros v2 (Commerce Court o Agentic Commerce Court). El operador deja de decidir disputas. | Puente Base↔Arbitrum de Kleros en producción y costo por caso medido. |
| **D4 · Fondo de arbitraje (opcional, por volumen)** | `setFeeRecipient` apunta a un repartidor inmutable de la comisión, por ejemplo 2,5 puntos para mantenimiento y 0,5 para un fondo que subvencione el arbitraje de órdenes pequeñas o pague a jurados en USDC. Solo aquí se evaluaría un jurado propio o un token de gobernanza, con asesoría legal. | Volumen de disputas que lo justifique. |

En todas las etapas, la comisión sigue siendo el 3% fijo del contrato y la única fuente de ingresos de la plataforma.

---

## 7. Si algún día hubiera un escrow v3

No está planificado, porque v2 permite todo lo anterior. Si se redesplegara por otra razón, convendría incluir:

- Un árbitro fijado en cada orden al crearla, para que los cambios de árbitro no afecten a las órdenes en curso.
- Un depósito para abrir una disputa, que se devuelve si la disputa prospera.
- Un plazo máximo para resolver, con un reparto por defecto si vence.
- Que no se pueda abrir una disputa después de la ventana de revisión, salvo para el vendedor.

---

## 8. Preguntas abiertas

1. Costo real de una disputa en Kleros v2 desde Base, y si la corte de agentes acepta casos de árbitros externos (*arbitrables*) que no estén en su lista permitida.
2. Si el puente entre Base y Arbitrum soporta el plazo de apelación sin dejar fondos expuestos.
3. Dónde guardar las pruebas de cada disputa de forma que el tribunal pueda leerlas: hoy los mensajes y los archivos están en la base de datos de la plataforma. Opción: IPFS con hash referenciado en la disputa.
4. Valores finales de `bond`, `T` y `P` según el comportamiento real en Sepolia.

Los comentarios se pueden dejar en un *issue* del repositorio o escribiendo a hello@mercadopleis.club.

---

## Referencias

- Kleros, *Development Update August 2026*: https://blog.kleros.io/kleros-development-update-august-2026/
- Kleros, *Development Update July 2026* (rutas de Vea para Base): https://blog.kleros.io/kleros-development-update-july-2026/
- Kleros v2, especificación del árbitro: https://github.com/kleros/kleros-v2/blob/dev/contracts/specifications/arbitrator.md
- Kleros, panel de jurados IA del Agentic Commerce Court: https://github.com/jaybuidl/ai-juror-dashboard
- Kleros Escrow: https://docs.kleros.io/products/escrow
- UMA y Polymarket, guía de disputas 2026: https://polymarkets.co.il/en/guide/uma-disputes/
- OpenZeppelin `TimelockController`: https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController
