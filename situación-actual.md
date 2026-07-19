# Situacion actual del servicio IA y onchain

## Alcance actual

El servicio IA expone `POST /payments/prepare`. Este endpoint prepara una propuesta de pago, pero no firma, no envia transacciones y no mueve fondos.

La respuesta `state: "awaiting_confirmation"` significa: la intencion fue parseada, la politica local la aprobo y se genero un mandato listo para confirmacion humana o firma de wallet. No significa dinero movido.

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
- `idempotencyKey`: hoy se usa solo como parte del hash deterministico, no como llave persistida.
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

Este DTO todavia no se envia a un modulo onchain interno. Queda como payload para que una capa posterior pida confirmacion/firma y luego registre o envie una transaccion.

## Idempotencia actual

La idempotencia actual es debil e incompleta.

Existe `idempotencyKey` en `PreparePaymentRequest`, y participa en `createPaymentId`. Sin embargo:

- no hay base de datos ni almacenamiento de resultados por `idempotencyKey`;
- no se compara el payload de un retry contra el payload original;
- no se devuelve la misma respuesta guardada ante retries;
- no hay bloqueo/concurrencia para dos requests simultaneos con la misma llave;
- `paymentId` incluye `expiration`, y `expiration` se calcula con `now`, por lo que dos requests iguales enviados en momentos distintos pueden generar IDs distintos aunque usen el mismo `idempotencyKey`;
- no existe un DTO de `SubmitPaymentRequest` o `RegisterSubmittedTransaction` que conecte de forma idempotente el mandato con un `txHash`.

Conclusion: repetir `POST /payments/prepare` hoy es seguro en terminos de fondos, porque no mueve dinero, pero no es idempotente en sentido estricto.

Verificacion local realizada:

```json
{
  "same": false,
  "firstExpiresAt": "2026-07-15T03:29:47.764Z",
  "secondExpiresAt": "2026-07-15T03:29:48.878Z"
}
```

La misma entrada con `idempotencyKey: "same-key"` genero dos `paymentId` distintos porque `expiresAt` cambia entre llamadas.

## Aceptado, rollback y movimiento de dinero

Estado actual:

- `APPROVED` en `policy` significa politica aprobada, no autorizacion financiera final.
- `awaiting_confirmation` significa propuesta preparada, no pago ejecutado.
- Antes de firma o envio onchain, no hay rollback financiero porque no hay efecto irreversible. Se puede abandonar, expirar o marcar como rechazado.
- Despues de una transaccion onchain confirmada, no existe rollback tecnico equivalente a revertir un HTTP request. Solo hay acciones compensatorias: refund, cancelacion previa a submit si aplica, o una nueva transaccion inversa segun el token/contrato.

El DTO actual soporta estados como `expired`, `duplicate`, `submitted`, `confirmed`, `reverted` y `failed`, pero no hay persistencia ni endpoints que transicionen esos estados.

## Viabilidad de la comunicacion IA -> onchain con DTO actual

El `PaymentMandate` es suficiente para preparar una transaccion wallet simple:

- `payer`
- `payee`
- `tokenAddress`
- `amountBaseUnits`
- `chainId`

No es suficiente para ejecucion robusta/idempotente contra onchain porque faltan:

- registro persistente de `paymentId`;
- `idempotencyKey` persistida con hash del request;
- estado transaccional por pago;
- `txHash`;
- `nonce` o identificador de autorizacion onchain si se usa EIP-3009;
- timestamps de submit/confirmacion;
- conteo de reintentos;
- forma de detectar y responder duplicados;
- outbox o job de envio si el agent llegara a enviar transacciones autonomamente;
- endpoint de callback/registro para cuando frontend wallet envie la transaccion.

## Buenas practicas verificadas

Referencias usadas:

- Stripe recomienda que los requests mutantes usen idempotency key, que el servidor guarde status y body del primer resultado, y que retries con la misma llave devuelvan el mismo resultado. Tambien compara parametros para evitar reuso accidental de llaves con payload distinto.
- Adyen recomienda idempotency key en POST de pagos, UUID como llave, retencion por una ventana definida, manejo de requests concurrentes y retries con backoff.
- RFC 9110 define que POST no es idempotente por defecto; un cliente no deberia reintentar automaticamente una operacion no idempotente salvo que el sistema provea semantica idempotente.

## Recomendacion

Si el servicio IA va a ser parte del flujo de pagos real, se debe implementar persistencia de idempotencia antes de conectar submit onchain.

Modelo minimo recomendado:

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
  txHash?: `0x${string}`;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
```

Reglas minimas:

1. `idempotencyKey` requerida para endpoints mutantes.
2. Crear `requestHash` canonico sin campos volatiles como `createdAt` o `expiresAt`.
3. Guardar resultado del primer request por `(userWallet, idempotencyKey)`.
4. Si llega la misma llave con el mismo `requestHash`, devolver la misma respuesta.
5. Si llega la misma llave con payload distinto, responder `409 Conflict`.
6. Si hay request concurrente con la misma llave, responder `409 Conflict` o esperar lock.
7. No mover fondos desde `prepare`; solo desde un endpoint posterior de autorizacion/submit.
8. Para submit onchain, guardar `txHash` y consultar estado antes de reintentar.

## Decision pendiente

Antes de implementar submit onchain, hay que decidir quien envia la transaccion:

- Wallet del usuario desde frontend: el agent prepara mandato y registra `txHash` enviado por el cliente.
- Wallet autonoma del agent: requiere storage, cola/outbox, nonce management, limites diarios y reintentos idempotentes.
- EIP-3009/X402: requiere DTO con firma/autorizacion, nonce/validAfter/validBefore y proteccion contra replay.

Para el estado actual del repo, la opcion mas consistente es mantener `prepare` sin efectos financieros y agregar persistencia/idempotencia en el agent antes de cualquier submit real.
