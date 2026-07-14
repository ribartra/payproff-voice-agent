# idefy

Monorepo para una aplicacion web con integracion onchain. El proyecto esta organizado por capas dentro de `apps/*` y usa Bun workspaces con Turborepo para ejecutar tareas desde la raiz.

## Stack

### Monorepo

- Runtime y package manager: Bun `1.3.3`
- Orquestacion: Turborepo
- Lenguaje: TypeScript
- Linting y formato: Biome

### Frontend

- React `19`
- Vite
- TanStack Start
- TanStack Router
- TanStack Query
- Tailwind CSS `4`
- shadcn/ui config con iconos de Lucide
- T3 Env y Zod para variables de entorno tipadas
- Viem para cliente Ethereum

### Onchain

- Solidity `0.8.28`
- Hardhat `3`
- Hardhat Toolbox Viem
- Hardhat Ignition
- Viem
- Tests con `node:test` y pruebas Solidity compatibles con Foundry

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
|   +-- onchain
|       +-- contracts
|       +-- ignition
|       +-- scripts
|       +-- test
+-- biome.json
+-- package.json
+-- turbo.json
```

## Requisitos

- Node.js `>=18`
- Bun `1.3.3`

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

Ejecutar una capa especifica:

```bash
cd apps/frontend
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
bun run lint
```

En `apps/frontend`:

```bash
bun run dev
bun run build
bun run serve
bun run test
bun run check
bun run lint
bun run format
```

En `apps/onchain`:

```bash
bun run dev
bunx hardhat test
bunx hardhat ignition deploy ignition/modules/Counter.ts
```

## Variables de entorno

### Frontend

Las variables del cliente deben usar el prefijo `VITE_`. Actualmente el frontend valida:

- `VITE_APP_TITLE`
- `SERVER_URL`

La configuracion esta en `apps/frontend/src/env.ts`.

### Onchain

Para desplegar en Sepolia, Hardhat espera:

- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`

Estas variables se consumen desde `apps/onchain/hardhat.config.ts`.

## Contratos

La capa onchain incluye un contrato de ejemplo `Counter` en `apps/onchain/contracts/Counter.sol`, pruebas TypeScript en `apps/onchain/test/Counter.ts`, pruebas Solidity en `apps/onchain/contracts/Counter.t.sol` y un modulo de despliegue Ignition en `apps/onchain/ignition/modules/Counter.ts`.

## Notas de organizacion

- `apps/frontend` contiene la experiencia web y la integracion con TanStack.
- `apps/onchain` contiene contratos, configuracion de red, tests y despliegues.
- No existen paquetes compartidos en `packages/*` por ahora. Si aparecen utilidades compartidas entre capas, conviene extraerlas a un paquete dedicado.
