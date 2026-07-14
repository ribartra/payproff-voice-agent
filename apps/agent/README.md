# Agent

Servicio interno de PayProof para orquestacion de intenciones, politicas, micropagos x402, verificacion onchain y TTS.

## Stack

- Node.js `>=24.13.0`
- Fastify `5.10.0`
- Google ADK `1.3.0`
- Google ADK Devtools `1.3.0`
- Google GenAI `2.11.0`
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

- `GEMINI_API_KEY`
- `DATABASE_URL`
- `CELO_SEPOLIA_RPC_URL`
- `CELO_MAINNET_RPC_URL`
- `X402_FACILITATOR_URL`
- `AGENT_WALLET_PRIVATE_KEY`
- `AGENT_MAX_PAYMENT_USDC`
- `AGENT_DAILY_BUDGET_USDC`
