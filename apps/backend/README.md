# Backend

Servicio HTTP para usuarios PayProof, contactos, aliases, sesiones, preparaciones idempotentes, eventos realtime y borde de integracion onchain.

## Responsabilidad actual

Esta capa es el sistema de identidad operativa, directorio de contactos y read model de pagos del MVP. No transcribe audio y no firma ni envia transacciones; solo delega preparaciones al `apps/agent` cuando el frontend llama la ruta persistente de pagos. Su estado persistente vive en Postgres y sus sesiones HTTP viven en Redis.

En el estado actual la sesion se inicia con email/password de demo. La wallet se vincula despues mediante challenge/firma EVM usando `POST /auth/wallet/challenge` y `POST /auth/wallet/link`. Wallet-first como reemplazo total del login sigue pendiente.

## Desarrollo

Levantar Postgres/Redis y aplicar seed:

```bash
bun run db:up
bun run db:migrate
```

```bash
bun run dev
```

Por defecto escucha en `http://127.0.0.1:3002`.

## Variables

- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `BACKEND_HOST`
- `BACKEND_PORT`
- `LOG_LEVEL`
- `AGENT_URL`
- `PAYMENT_MANAGER_ADDRESS`
- `REALTIME_EVENT_TTL_SECONDS`
- `WALLET_CHALLENGE_TTL_SECONDS`
- `CELO_RPC_HTTP_URL`
- `CELO_RPC_WS_URL`
- `CHAIN_INDEXER_START_BLOCK`
- `CHAIN_CONFIRMATIONS_REQUIRED`
- `CHAIN_REORG_LOOKBACK_BLOCKS`

## Endpoints

- `GET /health`
- `POST /auth/login`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /accounts`
- `GET /users/by-wallet/:walletAddress`
- `POST /users/:userId/contacts`
- `GET /users/:userId/contacts`
- `GET /users/:userId/assemblyai-keyterms`
- `POST /auth/wallet/challenge`
- `POST /auth/wallet/link`
- `POST /payments/preparations`
- `GET /payments/:paymentId`
- `POST /payments/:paymentId/submissions`
- `POST /payments/:paymentId/reconcile`
- `GET /payments/:paymentId/receipt`
- `GET /users/:userId/payments`
- `GET /ws`
- `GET /health/realtime`
- `GET /health/indexer`

Las migraciones SQL versionadas viven en `sql/`. Este paquete no ejecuta migraciones automaticamente.

## Diagrama de modulos

```txt
[Fastify server]
  | /auth/*, /users/*, /payments/*
  v
[UsersRepository] --- [Postgres users + contacts]
[PaymentsRepository] --- [Postgres payment read model]
[RealtimeRepository] --- [Postgres realtime + outbox]
[RedisSessionStore] --- [Redis sessions + wallet challenges]
[RedisRealtimePublisher] --- [Redis Pub/Sub]
[WebSocket gateway] --- [RealtimeRepository]
[WebSocket gateway] --- [RedisRealtimePublisher]
[Payments handlers] --- [Agent HTTP /payments/prepare]

[PaymentPreparationService] .... [HTTP handlers]
[ChainIndexer] .... [Celo RPC HTTP/WSS]
[ChainIndexer] .... [SQL chain event repository]
[OutboxWorker] .... [Runtime worker process]
[PaymentAgentTools] .... [ADK runtime tools]
```

## Modulos desacoplados

Ademas de los handlers HTTP, el backend contiene modulos probados que no se conectan automaticamente al arranque principal:

- `src/modules/payments/preparation-service.ts`: encapsula idempotencia de preparaciones con `requestHash`, retry y conflicto `409`.
- `src/modules/chain-indexer`: decodifica `PaymentExecuted`, ejecuta backfill por `getLogs`, guarda cursor y expone contratos para confirmar pagos.
- `src/modules/outbox/outbox-worker.ts`: drena eventos pendientes del outbox y publica por un publisher inyectado.
- `src/modules/ai-tools/payment-tools.ts`: expone `getUserContext`, `resolveContact` y `getPaymentStatus` para integracion posterior con tools ADK.

Estos modulos estan cubiertos por tests locales con repositorios/clientes falsos. No requieren RPC, contrato desplegado, Redis externo ni claves IA.

## Ciclo de vida de sesion

1. El frontend envia `POST /auth/login` con email y password.
2. El backend busca el usuario por email en `payproof_users`.
3. `verifyPassword` compara el password con el hash `scrypt`.
4. Si es valido, `RedisSessionStore.create` genera un session id aleatorio y lo guarda como `payproof:session:<id>` con TTL.
5. El backend responde usuario, contactos y keyterms, y setea cookie HTTP-only `pp_session`.
6. En cargas posteriores, `GET /auth/session` lee la cookie, consulta Redis y vuelve a hidratar usuario/contactos/keyterms desde Postgres.
7. `POST /auth/logout` borra la llave Redis y expira la cookie.

## Ciclo de vida de vinculacion wallet

1. El usuario debe tener una sesion activa por cookie.
2. El frontend envia wallet, red y chain id a `POST /auth/wallet/challenge`.
3. El backend guarda un challenge temporal en Redis y devuelve el mensaje a firmar.
4. La wallet firma el mensaje.
5. El frontend envia `challengeId`, `message`, `signature`, wallet y chain a `POST /auth/wallet/link`.
6. El backend consume el challenge, valida que coincida con la sesion y verifica la firma con `viem.verifyMessage`.
7. Si es valida, actualiza `wallet_address` y `network` del usuario en Postgres.

## Ciclo de vida de cuenta y contactos

1. `POST /accounts` valida `displayName`, `email`, `password` opcional, `walletAddress` y `network`.
2. `UsersRepository.upsertUser` crea o actualiza por `lower(wallet_address)`.
3. `POST /users/:userId/contacts` valida alias, wallet, red y token preferido.
4. `UsersRepository.upsertContact` crea o actualiza por `(user_id, lower(alias))`.
5. `GET /users/:userId/contacts` devuelve contactos ordenados por alias.
6. `GET /users/:userId/assemblyai-keyterms` transforma aliases/contactos en `keytermsPrompt`, que el frontend pasa al streaming de AssemblyAI para mejorar reconocimiento de nombres conocidos.

## Datos persistidos

- `payproof_users`: identidad local, email, hash de password, wallet EVM, red y timestamps.
- `payproof_contacts`: alias por usuario, wallet destino, red, token preferido y timestamps.
- `payproof_payment_preparations`: preparaciones aprobadas, idempotency key, request hash, mandato y estado.
- `payproof_payment_transactions`: `txHash` registrado por el frontend y estado de submit.
- `payproof_payment_events`: historial de eventos de aplicacion por pago.
- `payproof_chain_event_logs`: logs onchain indexados por `(chain_id, tx_hash, log_index)`.
- `payproof_chain_indexer_cursors`: cursor persistente por chain/contrato.
- `payproof_realtime_events` y `payproof_outbox_events`: eventos recientes y fan-out posterior a mutaciones.
- Redis: sesiones efimeras, challenges wallet temporales y Pub/Sub de realtime.

No se persisten private keys, audio, prompts completos ni estados confirmados inventados por el cliente.

## Ciclo de vida de pagos persistentes

1. El frontend envia `POST /payments/preparations` con `PreparePaymentRequest`.
2. El backend exige sesion, wallet del usuario e `idempotencyKey`.
3. Calcula `requestHash` canonico.
4. Si ya existe la misma key con el mismo hash, devuelve la preparacion guardada.
5. Si la key existe con otro hash, responde `409 IDEMPOTENCY_CONFLICT`.
6. Si es nueva, llama al agent en `AGENT_URL`, persiste la respuesta aprobada y emite `payment.prepared`.
7. Cuando el frontend obtiene `txHash`, llama `POST /payments/:paymentId/submissions`.
8. El backend valida usuario, chain, payer y contrato, registra la transaccion como `submitted` y emite `payment.submitted`.
9. `/reconcile` existe como borde estable, pero requiere RPC/indexer configurado para confirmar onchain.

## Ciclo de vida de indexacion pendiente de configuracion

1. El frontend registra `submitted` con `txHash`.
2. Cuando existan RPC HTTP/WSS, address de contrato y bloque inicial, `ChainIndexer` debe leer `PaymentExecuted`.
3. Cada log se decodifica y se persiste en `payproof_chain_event_logs`.
4. El repositorio concreto debe marcar la preparacion como `confirmed`, actualizar transaccion y emitir `payment.confirmed`.
5. Si WSS cae, `backfillOnce()` recupera logs por HTTP desde el cursor con lookback de reorg.

La clase y sus tests ya existen; falta conectarla a un proceso runtime.

## WebSocket de aplicacion

`GET /ws` reutiliza la cookie `pp_session`. El cliente envia:

```json
{ "type": "subscribe", "topics": ["payments", "contacts", "user"] }
```

El servidor envia envelopes versionados. Redis se usa para fan-out efimero y Postgres para retener eventos recientes. WebSocket no acepta comandos economicos.

## Usuario demo

El seed SQL crea un usuario de prueba para validar login, contactos y keyterms:

- Email: `demo@payproof.local`
- Password: `PayProofDemo2026!`

La sesion se guarda en Redis y se entrega al frontend mediante cookie HTTP-only `pp_session`.
