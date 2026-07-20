# Situacion actual del servicio IA y onchain

## Estado general de la aplicacion

El repo ya integra cuatro capas:

- `apps/frontend`: experiencia web de demo para login, contactos, voz, preparacion de pagos y TTS.
- `apps/backend`: usuarios, contactos, aliases, sesiones Redis, preparaciones idempotentes, submitted tx hashes y WebSocket de aplicacion.
- `apps/agent`: STT, parser IA/heuristico, politica deterministica, mandatos e introspecciones/TTS.
- `apps/onchain`: contrato `PaymentManager` con allowlist, replay protection y pruebas para pagos ERC-20 via `transferFrom`.

La experiencia actual todavia no es wallet-first. El usuario entra con email/password de demo; puede conectar una wallet injected, vincularla por challenge/firma y usarla para ejecutar pagos cuando exista `VITE_PAYMENT_MANAGER_ADDRESS`. La decision recomendada para migrar a DApp completa esta documentada en `consideracion-conexion-wallet.md`: `wagmi + viem + injected()`.

## Alcance actual

El servicio IA expone `POST /payments/prepare`. Este endpoint prepara una propuesta de pago, pero no firma, no envia transacciones y no mueve fondos.

La respuesta `state: "awaiting_confirmation"` significa: la intencion fue parseada, la politica local la aprobo y se genero un mandato listo para confirmacion humana o firma de wallet. No significa dinero movido.

## Ciclo de vida end-to-end actual

1. Postgres y Redis levantan con Docker Compose.
2. La migracion `apps/backend/sql/001_users_contacts.sql` crea usuario demo y contactos `proveedor`/`tesoreria`.
3. El frontend autentica contra `POST /auth/login`.
4. El backend crea una sesion Redis y devuelve cookie HTTP-only.
5. El frontend consulta o actualiza contactos en backend.
6. El backend deriva `keytermsPrompt` desde aliases/contactos.
7. El frontend pide token temporal de AssemblyAI al agent.
8. El browser transmite audio a AssemblyAI y actualiza el transcript.
9. El frontend llama introspeccion pregrabada para respuesta inmediata.
10. El frontend envia `PreparePaymentRequest` al backend.
11. El backend valida idempotencia y llama al agent para parsear, validar politica, crear mandatos y responder `PreparePaymentResponse`.
12. El backend persiste la preparacion y emite `payment.prepared`.
13. Si hay contrato configurado, el frontend puede pedir `approve` y `PaymentManager.pay` desde la wallet.
14. Al obtener `txHash`, el frontend registra `submitted` en backend.
15. El frontend puede pedir TTS para narrar el resultado.
16. La confirmacion onchain automatica queda pendiente de RPC WSS/indexer configurado.

## Modulos desacoplados ya implementados y probados

La rama contiene modulos que todavia no se conectan al arranque principal porque requieren configuracion externa, pero ya tienen pruebas locales:

- `apps/backend/src/modules/chain-indexer`: decoder de `PaymentExecuted`, clase `ChainIndexer`, backfill por `getLogs`, cursor y contrato de repositorios para confirmar pagos.
- `apps/backend/src/modules/outbox`: `OutboxWorker` para publicar eventos pendientes y reintentar fallos sin perder el read model persistido.
- `apps/backend/src/modules/payments`: `PaymentPreparationService` con semantica de idempotencia testeada para retry, conflicto y nueva preparacion.
- `apps/backend/src/modules/ai-tools`: tools para `getUserContext`, `resolveContact` y `getPaymentStatus` contra repositorios inyectables.
- `apps/frontend/src/lib/payment-flow.ts`: helper que arma el `PreparePaymentRequest` y decide que snapshots refrescar desde eventos realtime.
- `packages/celo`: helpers de suffix ERC-8021 para usar el codigo asignado por Celo Builders cuando exista.

Estos modulos permiten seguir integrando sin bloquearse por RPC, deploy de contrato, hosting WSS, codigo oficial de attribution, x402 o ERC-8004.

## Logica actual considerada

1. El cliente envia una transcripcion y contexto de seguridad al agent.
2. El agent valida `PreparePaymentRequest`.
3. `PaymentIntentParser` interpreta la orden. Si no hay `GEMINI_API_KEY`, usa heuristicas locales.
4. `resolveRecipient` resuelve el alias contra `merchantAllowlist`.
5. `evaluatePaymentPolicy` aplica reglas deterministicas:
   - confianza minima `0.90`;
   - token permitido;
   - destinatario resuelto y en allowlist;
   - monto mayor que cero;
   - monto menor o igual a `maxAmount`;
   - wallet del usuario valida.
6. Si la politica aprueba, `createPreparedPayment` construye:
   - `IntentMandate`;
   - `CheckoutMandate`;
   - `PaymentMandate`;
   - `mandateHash`.
7. El agent responde al cliente con `PreparePaymentResponse`.

## DTO que baja al servicio IA

`PreparePaymentRequest`:

```ts
{
  transcript: string;
  userWallet: `0x${string}`;
  network?: "celo-sepolia" | "celo";
  allowedTokens?: Array<"USDC" | "USDm">;
  merchantAllowlist?: Record<string, `0x${string}`>;
  maxAmount?: string;
  validMinutes?: number;
  idempotencyKey?: string;
  invoiceHash?: string;
}
```

Campos criticos:

- `transcript`: orden natural del usuario.
- `userWallet`: pagador esperado.
- `merchantAllowlist`: mapa alias -> address permitido.
- `maxAmount`: limite de politica para esa preparacion.
- `idempotencyKey`: en `/payments/preparations` es requerida y se persiste con `requestHash`; en el endpoint legacy del agent sigue siendo solo parte del hash.
- `invoiceHash`: evidencia externa opcional; si no existe, se usa el transcript para derivar `paymentId`.

## DTO que registra/prepara el servicio IA

`PreparePaymentResponse`:

```ts
{
  paymentId: string;
  state: PaymentState;
  intent: ParsedPaymentIntent;
  policy: PolicyDecision;
  intentMandate?: IntentMandate;
  checkoutMandate?: CheckoutMandate;
  paymentMandate?: PaymentMandate;
  confirmationPrompt: string;
}
```

`PaymentMandate` es el DTO actual mas cercano al borde onchain:

```ts
{
  id: string;
  checkoutMandateId: string;
  payer: `0x${string}`;
  payee: `0x${string}`;
  tokenAddress: `0x${string}`;
  amountBaseUnits: string;
  chainId: number;
  authorizationType: "WALLET_TRANSACTION" | "EIP3009" | "X402";
  signedAt?: string;
  signature?: `0x${string}`;
}
```

Este DTO ya puede llegar al frontend como parte de una preparacion persistida. Si hay contrato configurado, el frontend lo usa para pedir `approve`, ejecutar `PaymentManager.pay` y registrar el `txHash` en backend.

## Idempotencia actual

Hay dos superficies:

- `POST /payments/prepare` en el agent sigue siendo stateless y no persiste idempotencia. Se conserva por compatibilidad y tests de IA.
- `POST /payments/preparations` en el backend es la ruta recomendada para la app. Exige sesion, `idempotencyKey`, wallet del usuario y calcula `requestHash` canonico.

Reglas implementadas en backend:

- misma wallet + misma `idempotencyKey` + mismo `requestHash` devuelve la preparacion guardada;
- misma wallet + misma `idempotencyKey` + payload distinto responde `409 IDEMPOTENCY_CONFLICT`;
- la preparacion aprobada se guarda en `payproof_payment_preparations`;
- el submit de `txHash` se guarda en `payproof_payment_transactions`;
- cada cambio relevante emite un evento persistido/realtime.

Limite actual: no hay lock transaccional avanzado para concurrencia extrema y la confirmacion onchain automatica queda pendiente del indexador.

Adicionalmente existe `PaymentPreparationService`, probado de forma desacoplada, que encapsula la misma regla para facilitar mover la logica fuera del handler HTTP sin cambiar los DTO.

## Aceptado, rollback y movimiento de dinero

Estado actual:

- `APPROVED` en `policy` significa politica aprobada, no autorizacion financiera final.
- `awaiting_confirmation` significa propuesta preparada, no pago ejecutado.
- Antes de firma o envio onchain, no hay rollback financiero porque no hay efecto irreversible. Se puede abandonar, expirar o marcar como rechazado.
- Despues de una transaccion onchain confirmada, no existe rollback tecnico equivalente a revertir un HTTP request. Solo hay acciones compensatorias: refund, cancelacion previa a submit si aplica, o una nueva transaccion inversa segun el token/contrato.

El backend ya puede transicionar una preparacion a `submitted` cuando recibe `txHash`. La transicion automatica a `confirmed`, `failed` o `reorged` requiere RPC/indexer configurado.

## Viabilidad de la comunicacion IA -> onchain con DTO actual

El `PaymentMandate` es suficiente para preparar una transaccion wallet simple:

- `payer`
- `payee`
- `tokenAddress`
- `amountBaseUnits`
- `chainId`

Ya cubre el primer tramo robusto para wallet transaction:

- registro persistente de `paymentId`;
- `idempotencyKey` persistida con hash del request;
- estado transaccional por pago;
- `txHash` submitted;
- outbox/realtime para cambios de estado;
- endpoint de registro cuando frontend wallet envia la transaccion.

Sigue faltando para robustez completa:

- conectar el indexador ya testeado a RPC WSS/HTTP real;
- confirmaciones y reorg handling;
- reconciliacion automatica por receipt/log;
- `nonce` o identificador de autorizacion si se usa EIP-3009;
- proceso runtime para drenar outbox y worker de reconciliation.

## Buenas practicas verificadas

Referencias usadas:

- Stripe recomienda que los requests mutantes usen idempotency key, que el servidor guarde status y body del primer resultado, y que retries con la misma llave devuelvan el mismo resultado. Tambien compara parametros para evitar reuso accidental de llaves con payload distinto.
- Adyen recomienda idempotency key en POST de pagos, UUID como llave, retencion por una ventana definida, manejo de requests concurrentes y retries con backoff.
- RFC 9110 define que POST no es idempotente por defecto; un cliente no deberia reintentar automaticamente una operacion no idempotente salvo que el sistema provea semantica idempotente.

## Recomendacion

Modelo minimo ya implementado en backend:

```ts
PaymentPreparation {
  paymentId: string;
  idempotencyKey: string;
  requestHash: string;
  responseJson: unknown;
  state: PaymentState;
  userWallet: `0x${string}`;
  chainId: number;
  tokenAddress?: `0x${string}`;
  amountBaseUnits?: string;
  mandateHash?: `0x${string}`;
  txHash?: `0x${string}`; // en PaymentTransaction
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
```

Reglas cubiertas:

1. `idempotencyKey` requerida para endpoints mutantes.
2. Crear `requestHash` canonico sin campos volatiles como `createdAt` o `expiresAt`.
3. Guardar resultado del primer request por `(userWallet, idempotencyKey)`.
4. Si llega la misma llave con el mismo `requestHash`, devolver la misma respuesta.
5. Si llega la misma llave con payload distinto, responder `409 Conflict`.
6. Si hay request concurrente con la misma llave, el indice unico evita doble preparacion; falta manejo fino de lock/retry.
7. No mover fondos desde `prepare`; solo desde un endpoint posterior de autorizacion/submit.
8. Para submit onchain, guardar `txHash` y consultar estado antes de reintentar.

## Decision vigente

La transaccion principal la envia la wallet del usuario desde frontend. El agent prepara el mandato, el backend persiste la preparacion y el frontend registra el `txHash` enviado por el cliente.

Wallet autonoma del agent y EIP-3009/X402 quedan separados porque requieren budget persistido, nonce management, allowlists estrictas y settlement verificable.
