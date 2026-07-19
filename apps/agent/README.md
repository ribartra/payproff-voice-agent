# Agent

Servicio interno de PayProof para orquestacion de intenciones, politicas, micropagos x402, verificacion onchain y TTS.

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
- Viem `2.41.2`
- Zod `4.1.13`
- TypeScript `5.9.3`
- Biome `2.5.3`

## Desarrollo

```bash
bun run dev
```

El servicio escucha en `http://127.0.0.1:3001` por defecto y expone `GET /health`.

## Arquitectura desacoplada

La capa IA queda dividida por responsabilidades para poder reemplazar piezas sin tocar el flujo completo:

- `agent/`: adaptador Google ADK. Expone herramientas al LLM, pero no valida pagos ni mueve fondos.
- `modules/ai/`: parser de intencion. Usa Gemini si hay `GEMINI_API_KEY`; si no, cae a heuristicas locales para desarrollo y tests.
- `modules/policy/`: reglas deterministicas. Decide `APPROVED`, `REQUIRES_REVIEW` o `REJECTED` sin depender del modelo.
- `modules/mandates/`: construccion de `IntentMandate`, `CheckoutMandate` y `PaymentMandate`.
- `modules/payments/`: caso de uso de aplicacion. Orquesta parser, resolucion de destinatario, politica y mandatos.
- `modules/voice/`: STT AssemblyAI, introspecciones pregrabadas y respuesta de voz con Google Cloud TTS.
- `server.ts`: transporte HTTP Fastify. No contiene reglas de negocio.

Esta separacion permite ejecutar pruebas del core sin Gemini, AssemblyAI, wallet ni red Celo. Los contratos compartidos viven en `@payproof/domain`; las constantes publicas de red y tokens viven en `@payproof/celo`.

## Endpoints actuales

- `GET /health`: estado del servicio, red Celo configurada y disponibilidad de claves IA.
- `POST /payments/prepare`: recibe una transcripcion y prepara una propuesta de pago con politica y mandatos.
- `POST /voice/streaming-token`: genera token temporal de AssemblyAI para streaming desde browser.
- `POST /voice/transcribe-url`: transcribe un audio accesible por URL con AssemblyAI y acepta `keytermsPrompt` para aliases conocidos.
- `POST /voice/introspection`: devuelve un audio pregrabado corto para indicar que el agente esta procesando la orden.
- `POST /voice/receipt`: genera una respuesta corta para comunicar el estado de la propuesta.

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
