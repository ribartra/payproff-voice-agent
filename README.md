# idefy

Monorepo para una aplicacion web con integracion onchain y un agente de pagos por voz. El proyecto esta organizado por capas dentro de `apps/*` y `packages/*`, y usa Bun workspaces con Turborepo para ejecutar tareas desde la raiz.

## Stack

Las versiones listadas son las resueltas en `bun.lock`, salvo cuando se indica que vienen de configuracion o de `package.json`.

### Monorepo

- Runtime y package manager: Bun `1.3.14`
- Runtime Node soportado: Node.js `>=24.13.0`
- Workspaces: Bun workspaces sobre `apps/*` y `packages/*`
- Orquestacion: Turborepo `2.10.5`
- Lenguaje: TypeScript `5.9.3` en la raiz
- Linting y formato: Biome `2.5.3` unificado

### Frontend

- React `19.2.7` y React DOM `19.2.7`
- Vite `7.2.6` con `@vitejs/plugin-react` `5.1.1`
- TanStack Start `1.139.14`
- TanStack Router `1.139.16`, Router Devtools `1.139.15` y Router Plugin `1.139.14`
- TanStack Query `5.90.12` y Query Devtools `5.91.1`
- Tailwind CSS `4.1.17` con `@tailwindcss/vite` `4.1.17`
- shadcn/ui configurado con estilo `new-york`, Tailwind CSS v4 y Lucide como libreria de iconos
- Lucide React `0.544.0`
- T3 Env Core `0.13.11` y Zod `4.1.13` para variables de entorno tipadas
- Viem `2.41.2` para cliente Ethereum
- Wagmi `3.7.1` para conexion de wallet y hooks web3
- `@celo/attribution-tags` `0.3.0` para suffix ERC-8021 en transacciones Celo
- Utilidades UI: `class-variance-authority` `0.7.1`, `clsx` `2.1.1`, `tailwind-merge` `3.6.0` y `tw-animate-css` `1.4.0`
- Testing: Vitest `3.2.4`, Testing Library React `16.3.2`, Testing Library DOM `10.4.1` y jsdom `27.2.0`
- Tooling frontend: Biome `2.5.3`, TypeScript `5.9.3`, vite-tsconfig-paths `5.1.4`, React Compiler Babel plugin `1.0.0` y web-vitals `5.3.0`

### Agent

- Node.js `>=24.13.0`
- Fastify `5.10.0`
- Google ADK `1.3.0` y ADK Devtools `1.3.0`
- Google GenAI `2.11.0`
- AssemblyAI JS SDK `4.36.3`
- Prisma `7.8.0` y `@prisma/client` `7.8.0`
- Pino `10.3.1`
- x402 v2 scoped packages: `@x402/core`, `@x402/evm`, `@x402/express` y `@x402/fetch` `2.18.0`
- Viem `2.41.2`
- Zod `4.1.13`

### Onchain

- Solidity `0.8.28`
- Hardhat `3.0.17`
- Hardhat Toolbox Viem `5.0.1`
- Hardhat Ignition `3.0.6`
- Viem `2.41.2` resuelto en el monorepo (`apps/onchain` declara `^2.30.0`)
- TypeScript `5.9.3` en `apps/onchain`
- Tests con `node:test` y pruebas Solidity compatibles con Foundry
- `forge-std` declarado como `foundry-rs/forge-std#v1.9.4` y resuelto a `1eea5ba`

### Packages Compartidos

- `@payproof/domain`: schemas Zod y tipos compartidos de intencion, estado y decision de politica.
- `@payproof/celo`: cadenas Celo, tokens USDC/USDm y helpers de attribution tags sobre Viem.

## Estructura

```txt
.
+-- apps
|   +-- frontend
|   |   +-- src
|   |   |   +-- components
|   |   |   +-- integrations
|   |   |   +-- lib
|   |   |   +-- routes
|   |   +-- components.json
|   |   +-- vite.config.ts
|   +-- agent
|   |   +-- src
|   +-- onchain
|       +-- contracts
|       +-- ignition
|       +-- scripts
|       +-- test
+-- packages
|   +-- domain
|   |   +-- src
|   +-- celo
|       +-- src
+-- biome.json
+-- package.json
+-- turbo.json
```

## Modularidad desacoplada

El repo separa transporte, IA, politica, dominio y blockchain para que cada pieza pueda evolucionar de forma independiente:

- `packages/domain` define schemas y tipos compartidos, sin depender de Fastify, React, SDKs IA ni Celo.
- `packages/celo` concentra constantes publicas de red, tokens y helpers de atribucion.
- `apps/agent/src/modules/ai` interpreta la orden; `modules/policy` decide con reglas deterministicas; `modules/mandates` crea mandatos; `modules/voice` integra proveedores de voz.
- `apps/agent/src/server.ts` solo expone HTTP y delega el caso de uso a `modules/payments`.
- `apps/frontend` puede consumir el agente por HTTP interno sin tener claves de Gemini, AssemblyAI o wallets autonomas.

La intencion es poder cambiar el proveedor de STT/TTS, el modelo LLM, la politica de aprobacion o la red onchain sin reescribir la experiencia web ni los contratos de dominio.

## Requisitos

- Node.js `>=24.13.0`
- Bun `1.3.14`

## Instalacion

```bash
bun install
```

## Desarrollo

Ejecutar todas las apps configuradas en Turborepo:

```bash
bun run dev
```

El frontend levanta en `http://localhost:3000`.
El agente interno levanta en `http://127.0.0.1:3001`.

Ejecutar una capa especifica:

```bash
cd apps/frontend
bun run dev
```

```bash
cd apps/agent
bun run dev
```

```bash
cd apps/onchain
bun run dev
```

## Scripts principales

Desde la raiz:

```bash
bun run dev
bun run build
bun run test
bun run check
bun run check-types
bun run format
bun run lint
```

En `apps/frontend`:

```bash
bun run dev
bun run build
bun run serve
bun run test
bun run check-types
bun run check
bun run lint
bun run format
```

En `apps/agent`:

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

En `apps/onchain`:

```bash
bun run dev
bun run build
bun run test
bun run check
bun run check-types
bunx hardhat ignition deploy ignition/modules/Counter.ts
```

## Variables de entorno

Usa `.env.example` como plantilla local. Los archivos `.env*` reales estan ignorados por Git; los `.env.example` si se versionan.

### Frontend

Las variables del cliente deben usar el prefijo `VITE_`. Actualmente el frontend valida:

- `VITE_APP_TITLE`
- `VITE_WALLETCONNECT_PROJECT_ID` cuando se habilite WalletConnect
- `VITE_CELO_NETWORK` cuando se habilite seleccion de red
- `VITE_CELO_ATTRIBUTION_CODE` cuando se use un codigo de atribucion fijo
- `SERVER_URL`

La configuracion esta en `apps/frontend/src/env.ts`.

### Agent

El agente preve:

- `GEMINI_API_KEY`
- `DATABASE_URL`
- `CELO_SEPOLIA_RPC_URL`
- `CELO_MAINNET_RPC_URL`
- `X402_FACILITATOR_URL`
- `AGENT_WALLET_PRIVATE_KEY`
- `AGENT_MAX_PAYMENT_USDC`
- `AGENT_DAILY_BUDGET_USDC`

### Onchain

Para desplegar en Sepolia, Hardhat espera:

- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`

Estas variables se consumen desde `apps/onchain/hardhat.config.ts`.

## Contratos

La capa onchain incluye un contrato de ejemplo `Counter` en `apps/onchain/contracts/Counter.sol`, pruebas TypeScript en `apps/onchain/test/Counter.ts`, pruebas Solidity en `apps/onchain/contracts/Counter.t.sol` y un modulo de despliegue Ignition en `apps/onchain/ignition/modules/Counter.ts`.

## Notas de organizacion

- `apps/frontend` contiene la experiencia web, la integracion con TanStack, wallet y BFF ligero.
- `apps/agent` contiene el servicio interno del agente de pagos por voz.
- `apps/onchain` contiene contratos, configuracion de red, tests y despliegues.
- `packages/domain` contiene tipos y schemas compartidos sin dependencias de UI, blockchain o infraestructura.
- `packages/celo` contiene configuracion publica de Celo, tokens y helpers de attribution tags.
