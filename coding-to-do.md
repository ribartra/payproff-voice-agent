# PayProof — Coding To-Do para una entrega completa

## 1. Estado actual tomado como línea base

El repositorio ya tiene:

- frontend React/TanStack;
- backend Fastify con usuarios, contactos y aliases en Postgres;
- sesiones HTTP-only en Redis;
- agent service con Google ADK, Gemini, AssemblyAI, TTS y políticas determinísticas;
- contrato `PaymentManager` y tests locales;
- `wagmi`, `viem` y `@celo/attribution-tags` instalados;
- paquetes x402 instalados;
- WebSocket de audio directo entre browser y AssemblyAI.

Todavía falta:

- firma y ejecución onchain desde la wallet del usuario;
- persistencia de preparación, idempotencia y tx hash;
- indexación de eventos del contrato;
- WebSocket de aplicación para estados de pagos y cambios de contactos;
- reconciliación después de desconexiones;
- x402 real;
- ERC-8004 y evidencias de submission.

---

## 2. Corrección del concepto WebSocket

### 2.1 Lo que sí resuelve

WebSocket reducirá la latencia percibida al:

- escuchar eventos `PaymentExecuted` desde un RPC WSS;
- actualizar el read model en Postgres;
- notificar al frontend sin polling continuo;
- sincronizar contactos, aliases y perfil entre sesiones activas.

### 2.2 Lo que no resuelve

WebSocket no:

- acelera el consenso de Celo;
- reduce por sí solo el gas;
- sustituye la firma de la wallet;
- sustituye `waitForTransactionReceipt` o el backfill;
- debe ser la única copia de datos.

### 2.3 Nombre correcto de la arquitectura

La propuesta será una arquitectura **event-driven con read model**, no event sourcing completo.

- La blockchain es fuente de verdad de ejecución onchain.
- Postgres es fuente de verdad de la aplicación y vista indexada.
- Redis es transporte/fan-out efímero.
- WebSocket es canal de entrega en tiempo real.
- HTTP sigue siendo usado para commands, snapshots y recuperación.

---

## 3. Arquitectura objetivo

```text
                              COMMAND PATH

Usuario
  |
  | HTTP: login, contactos, prepare, submit txHash
  v
Frontend -------------------------------> Backend Fastify
  |                                           |
  | wallet injected                           | Postgres
  | sign/writeContract                        | users, contacts,
  v                                           | payments, events,
Wallet del usuario -> RPC HTTP -> Celo        | indexer cursor
                                                 |
                                                 | Redis Pub/Sub
                                                 v
                              EVENT / READ PATH

Celo -> RPC WSS -> ChainIndexer -> Postgres -> WS Gateway -> Frontend
                  |                ^
                  +-- HTTP getLogs-+  backfill/reconcile

Backend mutations -> transactional outbox -> Redis -> WS Gateway -> Frontend
(users, contacts, aliases)
```

### 3.1 Ubicación recomendada para el MVP

No crear un microservicio nuevo al inicio. Implementar dentro de `apps/backend`:

```text
apps/backend/src/modules/realtime
apps/backend/src/modules/chain-indexer
apps/backend/src/modules/outbox
apps/backend/src/modules/payments
```

Después de la hackathon, `chain-indexer` puede extraerse a `apps/indexer` sin cambiar sus interfaces.

### 3.2 Conexión de wallet

Para el MVP:

- conservar sesión email/password para perfil y contactos;
- usar `wagmi + viem + injected()` solo al momento de firmar;
- verificar que la wallet conectada sea la wallet vinculada al usuario;
- permitir vinculación mediante challenge/firma si no coincide.

Posterior:

- wallet-first como autenticación principal;
- WalletConnect;
- RainbowKit;
- smart accounts o MiniPay-specific UX.

---

## 4. Flujo completo esperado

```text
1. GET /auth/session devuelve snapshot de usuario, contactos y keyterms.
2. Frontend abre /ws usando la sesión existente.
3. Usuario conecta una wallet inyectada.
4. Usuario dicta o escribe la orden.
5. ADK interpreta y ejecuta tools de solo lectura/preparación.
6. Backend resuelve contacto y crea preparación idempotente.
7. Frontend presenta monto, token, recipient y política.
8. Usuario confirma.
9. Frontend ejecuta approve exacto si falta allowance.
10. Frontend ejecuta PaymentManager.pay con dataSuffix ERC-8021.
11. Al recibir txHash, POST /payments/:id/submissions marca submitted.
12. ChainIndexer recibe PaymentExecuted por RPC WSS.
13. ChainIndexer persiste log y confirma la preparación.
14. Backend publica payment.confirmed.
15. WS Gateway envía el evento al usuario correcto.
16. Frontend actualiza TanStack Query y muestra recibo/TTS.
17. Si WSS falla, el indexador recupera logs por HTTP desde el último cursor.
```

---

# P0 — Contratos de dominio y eventos

## C-001 — Ampliar `@payproof/domain`

Definir schemas y tipos compartidos:

```text
PaymentState
PreparedPaymentRecord
PaymentExecutionRequest
PaymentSubmissionRequest
PaymentTransactionRecord
ChainEventRecord
RealtimeEnvelope
RealtimeEvent
ContactRealtimePayload
UserRealtimePayload
```

Estados canónicos:

```text
draft
prepared
requires_review
awaiting_confirmation
submitting
submitted
confirmed
failed
expired
rejected
reorged
```

Campos económicos mínimos:

```text
paymentId
userId
userWallet
chainId
tokenAddress
tokenDecimals
recipientAddress
amountBaseUnits
idempotencyKey
requestHash
mandateHash
contractAddress
expiresAt
```

Reglas:

- [ ] Montos como string de unidades base, nunca `number`.
- [ ] Direcciones normalizadas.
- [ ] Estados y transiciones tipados.
- [ ] Errores tipados.
- [ ] Versionar envelopes de eventos.

Ejemplo:

```ts
interface RealtimeEnvelope<T> {
  eventId: string;
  type: string;
  version: 1;
  occurredAt: string;
  userId: string;
  aggregateId: string;
  payload: T;
}
```

## C-002 — Definir catálogo de eventos

Eventos de pagos:

```text
payment.prepared
payment.requires_review
payment.submitted
payment.confirmed
payment.failed
payment.expired
payment.reorged
```

Eventos de datos de usuario:

```text
user.updated
contact.created
contact.updated
contact.deleted
contacts.snapshot_invalidated
session.expired
```

Reglas:

- [ ] Todo evento incluye `eventId`, `userId`, `aggregateId` y versión.
- [ ] No incluir private keys, cookies, audio ni prompts completos.
- [ ] No emitir eventos antes de confirmar la transacción SQL que los origina.
- [ ] El frontend debe ignorar versiones desconocidas y pedir snapshot HTTP.

---

# P0 — Persistencia e idempotencia

## C-003 — Crear tablas de pagos

### `payproof_payment_preparations`

```text
id
payment_id UNIQUE
user_id
user_wallet
network
chain_id
token_symbol
token_address
token_decimals
recipient_address
amount_base_units
amount_display
idempotency_key
request_hash
mandate_hash UNIQUE
policy_decision
state
expires_at
created_at
updated_at
```

Restricciones:

- [ ] `UNIQUE(user_wallet, idempotency_key)` cuando exista.
- [ ] Monto positivo.
- [ ] Chain/token/contract configurados.

### `payproof_payment_transactions`

```text
id
payment_id FK
tx_hash UNIQUE
chain_id
contract_address
from_address
to_address
status
block_number
block_hash
confirmations
error_code
error_message
submitted_at
confirmed_at
```

### `payproof_payment_events`

Append-only de cambios de estado de aplicación.

## C-004 — Crear tablas del indexador

### `payproof_chain_event_logs`

```text
id
chain_id
contract_address
tx_hash
log_index
block_number
block_hash
event_name
payment_id
payload_json
removed
observed_at
confirmed_at
```

Restricción obligatoria:

```text
UNIQUE(chain_id, tx_hash, log_index)
```

### `payproof_chain_indexer_cursors`

```text
chain_id
contract_address
last_scanned_block
last_scanned_block_hash
updated_at
```

### `payproof_realtime_events`

Persistencia corta para permitir resume:

```text
event_id UNIQUE
user_id
aggregate_id
event_type
payload_json
created_at
expires_at
```

## C-005 — Crear transactional outbox

### `payproof_outbox_events`

```text
id
event_id UNIQUE
user_id
aggregate_id
event_type
payload_json
status
attempts
available_at
published_at
created_at
```

Uso:

- Contactos y usuarios se actualizan en Postgres.
- En la misma transacción SQL se inserta el evento outbox.
- Un publisher envía el evento a Redis.
- Después marca `published`.

**Aceptación:** si el backend cae después del commit, el evento se publica al reiniciar.

## C-006 — Servicio idempotente de pagos

- [ ] JSON canónico para `requestHash`.
- [ ] Misma key + mismo hash devuelve el mismo pago.
- [ ] Misma key + hash diferente retorna `409 IDEMPOTENCY_CONFLICT`.
- [ ] Bloqueo de fila durante submit/reconcile.
- [ ] Registro de transición y outbox en una sola transacción.
- [ ] No confiar en estado enviado por frontend.

**Aceptación:** dos requests concurrentes crean una sola preparación.

---

# P0 — WebSocket de aplicación

## C-007 — Añadir gateway WebSocket al backend

Dependencia propuesta:

```text
@fastify/websocket
```

Endpoint:

```text
GET /ws
```

Autenticación:

- [ ] Reutilizar cookie `pp_session` durante handshake.
- [ ] Resolver `userId` desde Redis.
- [ ] Rechazar conexiones sin sesión.
- [ ] No aceptar `userId` arbitrario del cliente.

Protocolo mínimo:

```json
{
  "type": "subscribe",
  "topics": ["payments", "contacts", "user"],
  "lastEventId": "optional"
}
```

Servidor envía `RealtimeEnvelope`.

Controles:

- [ ] Heartbeat ping/pong.
- [ ] Límite de mensajes y tamaño.
- [ ] Cierre de sockets al expirar sesión.
- [ ] Métrica de conexiones activas.
- [ ] Backpressure y descarte controlado de clientes lentos.

## C-008 — Implementar `RealtimePublisher`

Interfaz:

```ts
interface RealtimePublisher {
  publish(event: RealtimeEnvelope<unknown>): Promise<void>;
}
```

Implementación MVP:

```text
Postgres outbox -> Redis Pub/Sub -> WS Gateway
```

Canales internos:

```text
payproof:user:<userId>
payproof:system
```

- [ ] El canal Redis no contiene secretos.
- [ ] El gateway solo reenvía al usuario autenticado.
- [ ] Persistir el evento brevemente antes de pub/sub.
- [ ] Soportar resume por `lastEventId` consultando Postgres.

## C-009 — Cliente WebSocket en frontend

Crear:

```text
src/lib/realtime-client.ts
src/hooks/usePayProofRealtime.ts
```

Comportamiento:

- [ ] Abrir socket después de restaurar sesión.
- [ ] Reconnect con backoff y jitter.
- [ ] Enviar `lastEventId` al reconectar.
- [ ] Invalidar/actualizar TanStack Query según tipo.
- [ ] Mostrar indicador `realtime connected/reconnecting` en panel técnico.
- [ ] Si resume falla, volver a pedir snapshot HTTP.
- [ ] No bloquear el pago si el socket de aplicación está caído.

**Aceptación:** el estado converge correctamente después de recarga y reconexión.

---

# P0 — Usuarios, contactos y aliases en tiempo real

## C-010 — Mantener snapshot HTTP como carga inicial

La carga inicial sigue siendo:

```text
GET /auth/session
GET /users/:userId/contacts
GET /users/:userId/assemblyai-keyterms
```

- [ ] No reemplazar snapshots por mensajes WebSocket.
- [ ] Incluir versión o `updatedAt` de contactos.
- [ ] Cachear con TanStack Query.
- [ ] Rehidratar después de reconnect si hay inconsistencia.

## C-011 — Emitir eventos después de mutaciones de contactos

Al ejecutar:

```text
POST /users/:userId/contacts
PATCH /users/:userId/contacts/:contactId
DELETE /users/:userId/contacts/:contactId
```

Dentro de la misma transacción:

- [ ] Modificar Postgres.
- [ ] Recalcular `keytermsPrompt` o marcarlo inválido.
- [ ] Insertar outbox `contact.created|updated|deleted`.
- [ ] Publicar después del commit.

Payload sugerido:

```json
{
  "contact": {
    "id": "...",
    "alias": "cafeteria",
    "walletAddress": "0x...",
    "network": "celo-sepolia",
    "preferredToken": "USDC",
    "updatedAt": "..."
  },
  "keytermsPrompt": ["cafeteria"]
}
```

## C-012 — Sincronizar frontend

- [ ] Actualizar cache de contacto por ID.
- [ ] Reordenar por alias.
- [ ] Actualizar `keytermsPrompt` usado por AssemblyAI.
- [ ] Resolver conflicto mediante `updatedAt`.
- [ ] Si falta un evento, invalidar y volver a GET.

**Aceptación:** dos pestañas muestran el mismo directorio sin refresh manual.

---

# P0 — Chain indexer sobre Celo

## C-013 — Crear clientes Viem separados

En backend:

```text
chainHttpClient -> http(CELO_RPC_HTTP_URL)
chainWsClient   -> webSocket(CELO_RPC_WS_URL)
```

Responsabilidad:

- WSS: notificación de logs nuevos.
- HTTP: `getLogs`, receipts, block hashes y backfill.

Configurar:

- [ ] Keepalive.
- [ ] Reconexión con backoff.
- [ ] Error handler.
- [ ] Timeouts.
- [ ] Chain ID validado al arrancar.

No usar la wallet del usuario ni private keys en el indexador.

## C-014 — Escuchar `PaymentExecuted`

Usar `watchContractEvent` con:

```text
address: PAYMENT_MANAGER_ADDRESS
eventName: PaymentExecuted
poll: false con cliente WebSocket
```

Por cada log:

1. [ ] Validar dirección y chain.
2. [ ] Decodificar ABI.
3. [ ] Insertar idempotentemente en `chain_event_logs`.
4. [ ] Buscar preparación por `paymentId`.
5. [ ] Validar payer, token, recipient, amount y mandateHash.
6. [ ] Actualizar transacción/pago.
7. [ ] Insertar `payment.confirmed` en outbox.
8. [ ] Avanzar cursor solo después del commit.

## C-015 — Backfill obligatorio

Al arrancar y después de reconnect:

```text
fromBlock = max(deploymentBlock, lastScannedBlock - reorgLookback)
toBlock = latest
```

- [ ] Consultar logs por rangos pequeños.
- [ ] Insertar con unique key.
- [ ] Actualizar cursor por bloques procesados.
- [ ] Reintentar con backoff.
- [ ] Manejar rate limit.
- [ ] No saltar un rango si una llamada falla.

**Motivo:** una suscripción WebSocket no garantiza que todos los logs lleguen durante cortes.

## C-016 — Reorg y confirmaciones

- [ ] Guardar block hash y `removed` cuando el proveedor lo reporte.
- [ ] Comparar hash del último bloque escaneado al reiniciar.
- [ ] Marcar inicialmente `confirmed` con confirmaciones configurables para demo.
- [ ] Si un evento desaparece, marcar `reorged` y volver a reconciliar.
- [ ] No emitir recibo final irreversible antes del umbral configurado.

## C-017 — Fallback de reconciliación por tx hash

Aunque exista indexador:

- [ ] Mantener `waitForTransactionReceipt` en frontend para feedback local.
- [ ] Mantener worker backend para pagos `submitted`.
- [ ] Consultar receipt por HTTP.
- [ ] Decodificar `PaymentExecuted` desde receipt.
- [ ] Aplicar la misma función idempotente usada por el indexador.

**Aceptación:** cualquiera de las dos rutas converge al mismo estado sin duplicar.

---

# P0 — Contrato `PaymentManager`

## C-018 — Interfaz final mínima

```solidity
function pay(
    bytes32 paymentId,
    bytes32 mandateHash,
    address token,
    address recipient,
    uint256 amount
) external;
```

Agregar:

- [ ] `SafeERC20.safeTransferFrom`.
- [ ] Allowlist de tokens.
- [ ] `mapping(bytes32 => bool) executedPaymentIds`.
- [ ] Rechazo de replay.
- [ ] Rechazo de recipient/monto cero.
- [ ] Evento:

```solidity
event PaymentExecuted(
  bytes32 indexed paymentId,
  bytes32 indexed mandateHash,
  address indexed payer,
  address token,
  address recipient,
  uint256 amount
);
```

El evento debe contener todo lo necesario para reconciliar el pago, sin depender de una lectura extra del contrato.

## C-019 — Tests del contrato

- [ ] Pago exitoso.
- [ ] Allowance insuficiente.
- [ ] Balance insuficiente.
- [ ] Token no permitido.
- [ ] Recipient cero.
- [ ] Monto cero.
- [ ] `paymentId` duplicado.
- [ ] Campos exactos del evento.
- [ ] Compatibilidad con calldata + ERC-8021 suffix.
- [ ] Fuzz de `paymentId` y monto.

## C-020 — Deployment reproducible

- [ ] Ignition module de `PaymentManager`.
- [ ] Token allowlist por red.
- [ ] JSON de deployment.
- [ ] Exportar ABI, address y deployment block a `@payproof/celo`.
- [ ] Versionar Sepolia/Mainnet sin secretos.

---

# P0 — API de pagos

## C-021 — Endpoints

```text
POST /payments/preparations
GET  /payments/:paymentId
POST /payments/:paymentId/submissions
POST /payments/:paymentId/reconcile
GET  /payments/:paymentId/receipt
GET  /users/:userId/payments
```

Reglas:

- [ ] Sesión requerida.
- [ ] Usuario solo ve sus pagos.
- [ ] `submissions` recibe tx hash, no estado confirmado.
- [ ] Validar chain, sender, contract y preparación.
- [ ] Cada cambio produce outbox.
- [ ] GET devuelve snapshot canónico.

## C-022 — Estados al enviar

Antes de abrir wallet:

```text
awaiting_confirmation
```

Al iniciar firma:

```text
submitting
```

Al obtener tx hash:

```text
submitted
```

Después de receipt/log válido:

```text
confirmed
```

Rechazo de wallet no debe marcar `failed` onchain; usar error de interacción y permitir reintento.

---

# P0 — Conectar wallet sin reemplazar todavía el login

## C-023 — Configurar Wagmi

- [ ] `WagmiProvider` global.
- [ ] Celo Sepolia y Celo Mainnet.
- [ ] `injected()` como conector obligatorio.
- [ ] Detección de cuenta y chain.
- [ ] Balance y token balance.
- [ ] Botón conectar/desconectar.
- [ ] Manejar `accountsChanged` y `chainChanged`.

## C-024 — Vincular wallet a sesión

Opción mínima segura:

```text
POST /auth/wallet/challenge
POST /auth/wallet/link
```

- [ ] Usuario debe tener sesión email/password.
- [ ] Backend genera nonce de uso único.
- [ ] Wallet firma mensaje legible.
- [ ] Backend verifica firma.
- [ ] Guarda wallet vinculada al usuario.
- [ ] Para pagar, la cuenta conectada debe coincidir.

No es aún wallet-first; es una vinculación de wallet a la identidad existente.

## C-025 — WalletConnect posterior

No bloquear P0 con esto.

Después de completar `injected()`:

- [ ] `VITE_WALLETCONNECT_PROJECT_ID`.
- [ ] WalletConnect connector.
- [ ] RainbowKit opcional.
- [ ] Deep links móviles.
- [ ] Pruebas MiniPay/WalletConnect.

---

# P0 — Ejecución onchain desde frontend

## C-026 — Congelar preparación

- [ ] Persistir resultado aprobado por ADK.
- [ ] Mostrar recipient, token, monto, red y expiración.
- [ ] No permitir editar datos después de `mandateHash`.
- [ ] Cualquier cambio crea nuevo `paymentId`.
- [ ] Revalidar expiración y wallet vinculada.

## C-027 — Allowance seguro

- [ ] Leer allowance.
- [ ] `approve` por monto exacto.
- [ ] Esperar receipt de approve.
- [ ] Explicar que approve no es pago.
- [ ] Manejar rechazo y revert.

## C-028 — Ejecutar `PaymentManager.pay`

- [ ] Crear `dataSuffix` con tag asignado.
- [ ] Simular contrato antes de escribir.
- [ ] `writeContract` desde wallet conectada.
- [ ] Registrar estado `submitting`.
- [ ] Al obtener hash, llamar `submissions` inmediatamente.
- [ ] Ejecutar `waitForTransactionReceipt` para UX local.
- [ ] No marcar confirmado solo por resultado local; reconciliar backend.
- [ ] Mostrar explorer.

## C-029 — Attribution helper

En `@payproof/celo`:

- [ ] Helper único `buildAttributionSuffix`.
- [ ] Requerir tag asignado en producción.
- [ ] Permitir array `[ownCode, assignedCode]`.
- [ ] CLI `verify-attribution <txHash>`.
- [ ] Test de integración.

---

# P0 — Google ADK como agente real

## C-030 — Tools explícitas

Tools mínimas:

```text
get_user_context()
resolve_contact(alias)
get_payment_policy_context()
fetch_invoice_x402(invoiceId, merchant)
prepare_payment(input)
get_payment_status(paymentId)
```

No exponer al LLM:

```text
send_raw_transaction
arbitrary_fetch
arbitrary_contract_call
read_private_key
```

## C-031 — Separar intención y ejecución

- [ ] LLM devuelve DTO validado.
- [ ] Resolución de alias en código/DB.
- [ ] Montos y token validados determinísticamente.
- [ ] ADK no decide direcciones arbitrarias.
- [ ] ADK no firma pago principal.
- [ ] Ejecución requiere confirmación humana.
- [ ] Respuestas TTS leen estado persistido.

## C-032 — Integrar eventos con ADK

- [ ] `get_payment_status` consulta backend/read model, no RPC directo.
- [ ] El agente puede explicar `submitted` vs `confirmed`.
- [ ] No reintenta un pago confirmado.
- [ ] Si falta un evento, solicita reconcile.

---

# P1 — x402

## C-033 — Caso de uso

Endpoint ejemplo:

```text
GET /invoices/:invoiceId
```

Sin pago:

```text
HTTP 402 Payment Required
```

Después de settlement:

```json
{
  "invoiceId": "INV-001",
  "merchantAlias": "cafeteria",
  "recipient": "0x...",
  "amount": "0.50",
  "token": "USDC",
  "expiresAt": "...",
  "signature": "0x..."
}
```

## C-034 — Merchant provider

- [ ] Middleware x402 compatible.
- [ ] Precio y `payTo` configurados.
- [ ] Validar invoice ID.
- [ ] Respuesta solo tras pago.
- [ ] Hash/firma de factura.
- [ ] Rate limit.
- [ ] Health no pagado.

## C-035 — Cliente x402 del agente

- [ ] Wallet solo en servidor.
- [ ] `@x402/fetch`.
- [ ] Allowlist de host/path.
- [ ] Precio máximo.
- [ ] Presupuesto diario persistido.
- [ ] Timeout y reintento idempotente.
- [ ] Persistir settlement.
- [ ] No pagar URL creada libremente por LLM.

## C-036 — Eventos x402

Eventos:

```text
x402.requested
x402.payment_submitted
x402.payment_confirmed
x402.resource_received
x402.failed
```

- [ ] Persistirlos.
- [ ] Emitirlos al frontend del usuario relacionado.
- [ ] Mostrar claramente que paga la wallet del agente.
- [ ] Verificar attribution según mecanismo oficial.

---

# P1 — Recibos, historial y UX

## C-037 — Recibo verificable

`GET /payments/:paymentId/receipt` devuelve:

- payment ID;
- estado;
- tx hash;
- chain;
- token/monto;
- payer/recipient;
- mandate hash;
- block/confirmations;
- explorer URL;
- timestamps.

TTS se genera solo desde este payload persistido.

## C-038 — Historial

- [ ] Lista paginada.
- [ ] Filtros por estado.
- [ ] Abrir recibo.
- [ ] Reconciliar pendiente.
- [ ] Actualización incremental por WebSocket.
- [ ] Snapshot HTTP después de reconnect.

## C-039 — UX de estado

Mostrar separadamente:

```text
Preparado
Esperando confirmación
Esperando firma
Enviado a la red
Detectado por indexador
Confirmado
Fallido/Reorganizado
```

No usar “pago realizado” al recibir solo el tx hash.

---

# P1 — Seguridad

## C-040 — Secretos

- [ ] Private key x402 solo en agent.
- [ ] Ningún secreto `VITE_`.
- [ ] Redacción en Pino.
- [ ] No loggear audio.
- [ ] No loggear cookies ni headers de pago.

## C-041 — WebSocket seguro

- [ ] Origin allowlist.
- [ ] Sesión validada en handshake.
- [ ] Autorización por usuario.
- [ ] Rate limit de conexiones/reconnect.
- [ ] Heartbeat.
- [ ] Tamaño máximo de mensaje.
- [ ] No aceptar comandos económicos por WS.

Los commands que cambian dinero siguen pasando por endpoints HTTP validados y por la wallet.

## C-042 — Chain validation

- [ ] Chain ID al arrancar.
- [ ] Contract address por red.
- [ ] Token address/decimals por red.
- [ ] Verificar evento contra preparación.
- [ ] Evitar aceptar logs de contratos no configurados.

---

# P1 — Pruebas

## C-043 — Unit tests

- [ ] Canonicalización/requestHash.
- [ ] State machine.
- [ ] Outbox.
- [ ] Event serialization/versioning.
- [ ] Contact event reducer.
- [ ] Indexer log decoder.
- [ ] Duplicate log handling.
- [ ] Reorg handling.
- [ ] Attribution suffix.
- [ ] x402 budget.

## C-044 — Integration tests

- [ ] Contact update -> outbox -> Redis -> WS client.
- [ ] Payment submit -> indexer log -> DB -> WS client.
- [ ] Dos logs duplicados crean un registro.
- [ ] Reinicio continúa desde cursor.
- [ ] Corte WSS + backfill HTTP.
- [ ] Misma idempotency key concurrente.
- [ ] Receipt worker e indexer convergen.
- [ ] Sesión expirada cierra socket.

## C-045 — E2E local con Hardhat

- [ ] Levantar Hardhat local.
- [ ] Desplegar contrato.
- [ ] Configurar frontend wallet hacia red local.
- [ ] Ejecutar approve/pay.
- [ ] Ver evento en indexador.
- [ ] Actualización frontend por WS.
- [ ] Simular restart del indexador.

Si el RPC local no soporta bien WSS, usar polling/getLogs localmente; el contrato y pipeline deben ser los mismos.

## C-046 — E2E Sepolia/Mainnet

Escenarios:

1. [ ] Pago por texto.
2. [ ] Pago por voz.
3. [ ] Alias resuelto.
4. [ ] Contacto actualizado en otra pestaña.
5. [ ] x402 + pago principal.
6. [ ] Rechazo de firma.
7. [ ] Red incorrecta.
8. [ ] Tx revertida.
9. [ ] Socket de aplicación reconectado.
10. [ ] RPC WSS desconectado y backfill.
11. [ ] Replay idempotente.
12. [ ] Attribution verificada.

---

# P2 — Observabilidad y submission

## C-047 — Health endpoints

```text
GET /health
GET /health/realtime
GET /health/indexer
```

Incluir sin secretos:

- estado Postgres;
- estado Redis;
- WSS conectado/reconectando;
- último bloque indexado;
- lag respecto a latest block;
- sockets activos.

## C-048 — Project info

```text
GET /project-info
```

- Nombre/versión.
- Commit.
- Chain.
- Contract address.
- Deployment block.
- Attribution code.
- ERC-8004.
- x402 endpoint/payTo.
- Repo/docs.

## C-049 — Métricas

- pagos preparados;
- pagos submitted/confirmed/failed;
- volumen;
- lag del indexador;
- reconnects RPC WSS;
- sockets activos;
- eventos outbox pendientes;
- compras x402.

## C-050 — README final

Actualizar los README para que describan el estado real:

```text
HTTP = commands y snapshots
RPC WSS = logs de blockchain
App WS = actualizaciones al frontend
Postgres = persistencia/read model
Redis = sesión y fan-out efímero
```

Incluir diagrama, recuperación ante desconexión, limitaciones y roadmap de WalletConnect/wallet-first.

---

# 5. Orden de implementación recomendado

## Fase 1 — Base persistente y contrato

1. C-001/C-002 tipos y eventos.
2. C-003/C-004 tablas.
3. C-005/C-006 outbox e idempotencia.
4. C-018/C-019/C-020 contrato y deployment.

**Gate:** pago local genera evento correcto y puede persistirse idempotentemente.

## Fase 2 — Realtime e indexador

1. C-007/C-008 gateway y publisher.
2. C-009 frontend realtime.
3. C-013/C-014 indexer WSS.
4. C-015/C-016 backfill/reorg.
5. C-017 reconciliación.

**Gate:** evento onchain actualiza UI y sobrevive restart/desconexión.

## Fase 3 — Contactos y aliases reactivos

1. C-010 snapshot.
2. C-011 outbox de contactos.
3. C-012 sincronización frontend.

**Gate:** dos pestañas convergen y AssemblyAI recibe keyterms actualizados.

## Fase 4 — Wallet y pago real

1. C-023 Wagmi injected.
2. C-024 wallet linking.
3. C-026/C-027 preparación/allowance.
4. C-028/C-029 pago y attribution.
5. C-021/C-022 APIs y estados.

**Gate:** Sepolia completo con tx atribuida y recibo persistido.

## Fase 5 — ADK y x402

1. C-030/C-031/C-032 tools.
2. C-033/C-034 provider.
3. C-035/C-036 cliente/eventos.

**Gate:** x402 real, controlado e idempotente.

## Fase 6 — Producto y submission

1. C-037/C-038/C-039 UX.
2. C-040/C-041/C-042 seguridad.
3. C-043–C-046 tests.
4. C-047–C-050 evidencia.

---

# 6. Plan por fechas

| Fecha | Entregable de coding |
|---|---|
| 19–21 julio | Tipos, tablas, outbox, idempotencia y contrato |
| 21–24 julio | WS gateway, indexador, cursor y backfill |
| 24–25 julio | Contactos/aliases realtime |
| 25–27 julio | Wallet inyectada, submit, receipt y attribution |
| 27–29 julio | ADK tools y x402 |
| 29–30 julio | Mainnet controlado y resiliencia |
| 30 julio–1 agosto | E2E, UX, seguridad y README |
| 2 agosto | Freeze y correcciones críticas |

---

# 7. Definition of Done

- [ ] Login actual conserva perfiles/contactos.
- [ ] Wallet inyectada firma el pago principal.
- [ ] Wallet vinculada coincide con usuario.
- [ ] Preparación persistida e idempotente.
- [ ] Contrato previene replay.
- [ ] Pago lleva attribution tag.
- [ ] `txHash` se registra inmediatamente.
- [ ] ChainIndexer escucha `PaymentExecuted` por WSS.
- [ ] Indexer recupera eventos perdidos por HTTP.
- [ ] Cursor persiste tras restart.
- [ ] Postgres contiene read model verificable.
- [ ] Frontend recibe cambios por app WebSocket.
- [ ] Frontend también puede restaurar estado por HTTP.
- [ ] Contactos y aliases se sincronizan entre pestañas.
- [ ] Redis no es fuente única de verdad.
- [ ] ADK usa tools estructuradas.
- [ ] x402 es real y limitado por presupuesto, si se presenta Track 2.
- [ ] Recibo/TTS provienen del estado persistido.
- [ ] Sepolia completo y evidencia final en red aceptada.
- [ ] README y demo distinguen correctamente WebSocket, RPC y confirmación.

---

# 8. Recortes permitidos

Recortar en este orden:

1. WalletConnect y RainbowKit.
2. Wallet-first como reemplazo del login.
3. Extraer indexador a microservicio independiente.
4. Resume avanzado por historial largo; conservar snapshot HTTP.
5. Historial avanzado.
6. Segundo stablecoin.
7. Dashboard de métricas.
8. TTS dinámico; conservar texto.
9. Askbots/Aigora.

No recortar:

- pago real;
- attribution tag;
- idempotencia;
- evento `PaymentExecuted`;
- indexador con backfill;
- estado persistido;
- actualización al frontend;
- URL pública;
- ERC-8004;
- video y submission.

---

# 9. Estado de implementacion tras la revision actual

## Implementado y probado localmente

- Dominio compartido ampliado con `ChainEventRecord` y DTOs de pagos/realtime.
- Tablas de pagos, transacciones, eventos, logs de chain, cursor, realtime y outbox.
- Preparaciones idempotentes en backend y `PaymentPreparationService` desacoplado con tests de retry/conflicto/nueva preparacion.
- Contrato `PaymentManager` con allowlist, proteccion de replay y tests de transferencia ERC-20.
- Wallet injected en frontend, challenge/firma para vincular wallet, allowance exacto, `PaymentManager.pay` y registro de `txHash` submitted.
- WebSocket de aplicacion para eventos persistidos/realtime y helper frontend para decidir refresco de snapshots.
- Modulos no conectados pero testeados para `ChainIndexer`, decoder de `PaymentExecuted`, backfill `getLogs`, cursor y confirmacion de read model.
- Worker de outbox desacoplado y testeado para publicar pendientes y reintentar fallos.
- Tools IA desacopladas y testeadas: `getUserContext`, `resolveContact`, `getPaymentStatus`.
- Helpers de attribution en `@payproof/celo`, incluyendo preferencia por codigo asignado por Celo Builders.

## Parcial

- C-005/C-007/C-008: outbox y realtime existen, pero el worker no corre como proceso permanente por defecto.
- C-013/C-017: indexador ya tiene clases y tests, pero no esta cableado a RPC real ni a un proceso persistente.
- C-021/C-022/C-037: endpoints de preparacion, submission, receipt y reconcile existen, pero `confirmed/failed/reorged` dependen del indexador runtime.
- C-028/C-029: ejecucion wallet existe; falta anexar el attribution suffix a calldata real cuando se tenga el codigo oficial.
- C-030/C-032: tools IA existen como modulos inyectables; falta conectarlas al runtime ADK si se decide exponerlas como tools de agente.

## Pendiente por coding posterior

- Conectar `ChainIndexer` a clientes `viem` HTTP/WSS reales, startup controlado, heartbeat y backfill continuo.
- Implementar repositorios SQL concretos para confirmar automaticamente `PaymentExecuted` y marcar `confirmed/failed/reorged`.
- Ejecutar `OutboxWorker` como proceso o tarea controlada y evitar doble publicacion en topologias multiinstancia.
- Agregar suffix ERC-8021 al `writeContract` del frontend cuando exista `CELO_BUILDERS_ATTRIBUTION_CODE`.
- Integrar x402 real y ERC-8004 solo despues de completar configuracion externa.
- Añadir pruebas E2E browser contra servicios levantados y wallet mock.
