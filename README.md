# idefy

Monorepo para una aplicacion web con integracion onchain. El proyecto esta organizado por capas dentro de `apps/*` y usa Bun workspaces con Turborepo para ejecutar tareas desde la raiz.

## Stack

Las versiones listadas son las resueltas en `bun.lock`, salvo cuando se indica que vienen de configuracion o de `package.json`.

### Monorepo

- Runtime y package manager: Bun `1.3.3`
- Workspaces: Bun workspaces sobre `apps/*`
- Orquestacion: Turborepo `2.6.3`
- Lenguaje: TypeScript `5.9.2` en la raiz
- Linting y formato: Biome `2.3.8` en la raiz

### Frontend

- React `19.2.1` y React DOM `19.2.1`
- Vite `7.2.6` con `@vitejs/plugin-react` `5.1.1`
- TanStack Start `1.139.14`
- TanStack Router `1.139.16`, Router Devtools `1.139.15` y Router Plugin `1.139.14`
- TanStack Query `5.90.12` y Query Devtools `5.91.1`
- Tailwind CSS `4.1.17` con `@tailwindcss/vite` `4.1.17`
- shadcn/ui configurado con estilo `new-york`, Tailwind CSS v4 y Lucide como libreria de iconos
- Lucide React `0.544.0`
- T3 Env Core `0.13.8` y Zod `4.1.13` para variables de entorno tipadas
- Viem `2.41.2` para cliente Ethereum
- Utilidades UI: `class-variance-authority` `0.7.1`, `clsx` `2.1.1`, `tailwind-merge` `3.4.0` y `tw-animate-css` `1.4.0`
- Testing: Vitest `3.2.4`, Testing Library React `16.3.0`, Testing Library DOM `10.4.1` y jsdom `27.2.0`
- Tooling frontend: Biome `2.2.4`, TypeScript `5.9.2`, vite-tsconfig-paths `5.1.4`, React Compiler Babel plugin `1.0.0` y web-vitals `5.1.0`

### Onchain

- Solidity `0.8.28`
- Hardhat `3.0.17`
- Hardhat Toolbox Viem `5.0.1`
- Hardhat Ignition `3.0.6`
- Viem `2.41.2` resuelto en el monorepo (`apps/onchain` declara `^2.30.0`)
- TypeScript `5.8.3` en `apps/onchain`
- Tests con `node:test` y pruebas Solidity compatibles con Foundry
- `forge-std` declarado como `foundry-rs/forge-std#v1.9.4` y resuelto a `1eea5ba`

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
