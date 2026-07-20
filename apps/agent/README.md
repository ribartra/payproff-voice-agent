# Agent

Servicio interno de PayProof para orquestacion de intenciones, politicas, voz y TTS.

En el estado actual este servicio prepara propuestas de pago. No firma, no hace submit onchain, no ejecuta x402 y no mueve fondos.

La persistencia idempotente y el submit de `txHash` no viven aqui; los maneja `apps/backend`. Este servicio sigue siendo el borde IA/voz y puede correr sin Postgres si solo se prueban parser, politica, introspecciones y TTS.

## Stack

- Node.js `>=24.13.0`
- Fastify `5.10.0`
- Google ADK `1.3.0`
- Google ADK Devtools `1.3.0`
- Google GenAI `2.11.0`
- Google Cloud Text-to-Speech `6.4.1`
- AssemblyAI JS SDK `4.36.3`
- Prisma `7.8.0` y `@prisma/client` `7.8.0`
- Pino `10.3.1`
- x402 v2 scoped packages `2.18.0`
- Viem `2.55.4`
- Zod `4.1.13`
- TypeScript `5.9.3`
- Biome `2.5.3`

## Desarrollo

```bash
bun run dev
```

El servicio escucha en `http://127.0.0.1:3001` por defecto y expone `GET /health`.

## Diagrama de modulos

```txt
[Fastify server]
  | /payments/prepare
  v
[PaymentApplication] --- [PaymentIntentParser]
[PaymentApplication] --- [resolveRecipient]
[PaymentApplication] --- [evaluatePaymentPolicy]
[PaymentApplication] --- [createPreparedPayment]

[Fastify server]
  | /voice/*
  v
[Voice modules] --- [AssemblyAI token/transcribe]
[Voice modules] --- [Pre-recorded introspections]
[Voice modules] --- [Google Cloud TTS]

[Google ADK adapter] .... [Runtime tools]
[Backend PaymentAgentTools] .... [Agent runtime]
[x402 packages] .... [Facilitator / merchant]
[Agent wallet] .... [Autonomous x402 payments]
```

## Arquitectura desacoplada

La capa IA queda dividida por responsabilidades para poder reemplazar piezas sin tocar el flujo completo:

- `agent/`: adaptador Google ADK. Expone herramientas al LLM, pero no valida pagos ni mueve fondos.
- `modules/ai/`: parser de intencion. Usa Gemini si hay `GEMINI_API_KEY`; si no, cae a heuristicas locales para desarrollo y tests.
- `modules/policy/`: reglas deterministicas. Decide `APPROVED`, `REQUIRES_REVIEW` o `REJECTED` sin depender del modelo.
- `modules/mandates/`: construccion de `IntentMandate`, `CheckoutMandate` y `PaymentMandate`.
- `modules/payments/`: caso de uso de aplicacion. Orquesta parser, resolucion de destinatario, politica y mandatos.
- `modules/voice/`: STT AssemblyAI, introspecciones pregrabadas y respuesta de voz con Google Cloud TTS.
- `server.ts`: transporte HTTP Fastify. No contiene reglas de negocio.

Las tools de backend para `getUserContext`, `resolveContact` y `getPaymentStatus` ya existen de forma desacoplada en `apps/backend/src/modules/ai-tools`. Aun no estan conectadas como tools runtime de ADK para evitar acoplar el agente a Postgres antes de definir seguridad y despliegue.

Esta separacion permite ejecutar pruebas del core sin Gemini, AssemblyAI, wallet ni red Celo. Los contratos compartidos viven en `@payproof/domain`; las constantes publicas de red y tokens viven en `@payproof/celo`.

## Endpoints actuales

- `GET /health`: estado del servicio, red Celo configurada y disponibilidad de claves IA.
- `POST /payments/prepare`: recibe una transcripcion y prepara una propuesta de pago con politica y mandatos.
- `POST /voice/streaming-token`: genera token temporal de AssemblyAI para streaming desde browser.
- `POST /voice/transcribe-url`: transcribe un audio accesible por URL con AssemblyAI y acepta `keytermsPrompt` para aliases conocidos.
- `POST /voice/introspection`: devuelve un audio pregrabado corto para indicar que el agente esta procesando la orden.
- `POST /voice/receipt`: genera una respuesta corta para comunicar el estado de la propuesta.

## Ciclo de vida de preparacion de pago

1. El frontend envia `PreparePaymentRequest` a `POST /payments/prepare`.
2. Fastify valida el payload con `preparePaymentRequestSchema` desde `@payproof/domain`.
3. `PaymentApplication.prepare` invoca `PaymentIntentParser`.
4. `PaymentIntentParser` usa Gemini si `GEMINI_API_KEY` existe; si no, usa heuristicas locales para desarrollo.
5. `resolveRecipient` cruza `recipientAlias` contra `merchantAllowlist`.
6. `evaluatePaymentPolicy` aplica reglas deterministicas: confianza, token permitido, alias resuelto, monto positivo, limite `maxAmount` y wallet valida.
7. `createPreparedPayment` construye `paymentId`, `IntentMandate`, `CheckoutMandate`, `PaymentMandate`, `mandateHash` y `confirmationPrompt`.
8. El endpoint responde `PreparePaymentResponse`; si la politica rechaza, responde `422`.

`state: "awaiting_confirmation"` significa que el pago esta listo para revision/firma externa. No equivale a dinero enviado.

## Ciclo de vida de voz

1. Para streaming, el frontend llama `POST /voice/streaming-token`.
2. El agente solicita a AssemblyAI un token temporal con TTL configurado.
3. El browser abre WebSocket contra AssemblyAI y envia audio PCM 16 kHz; la API key nunca llega al cliente.
4. El frontend usa los turns finales para alimentar el transcript que se manda a `/payments/prepare`.
5. Para introspeccion, `POST /voice/introspection` devuelve un MP3 pregrabado y un intent preliminar local.
6. Para recibo, `POST /voice/receipt` recibe el `PreparePaymentResponse` y usa Google Cloud Text-to-Speech para devolver texto y audio base64.

## DTOs principales

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

## Idempotencia y efectos

`idempotencyKey` existe en el request del agent y participa en el identificador de la propuesta, pero `/payments/prepare` sigue siendo stateless por compatibilidad. La ruta recomendada de la app es `POST /payments/preparations` del backend: ahi se exige sesion, se calcula `requestHash`, se persiste la preparacion y se devuelve la misma respuesta en retries equivalentes.

## Scripts

```bash
bun run dev
bun run build
bun run start
bun run test
bun run check
bun run check-types
bun run lint
bun run format
```

## Variables previstas

- `HOST`
- `PORT`
- `LOG_LEVEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_TTS_MODEL`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `ASSEMBLYAI_API_KEY`
- `ASSEMBLYAI_TOKEN_TTL_SECONDS`
- `DATABASE_URL`
- `CELO_SEPOLIA_RPC_URL`
- `CELO_MAINNET_RPC_URL`
- `X402_FACILITATOR_URL`
- `AGENT_WALLET_PRIVATE_KEY`
- `AGENT_MAX_PAYMENT_USDC`
- `AGENT_DAILY_BUDGET_USDC`
