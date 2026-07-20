# PayProof Voice Agent

Monorepo para una DApp de pagos agenticos sobre Celo. La aplicacion permite iniciar sesion local de demo, administrar contactos con aliases, capturar una orden por voz o texto, pedir al agente que prepare una propuesta de pago y recibir una respuesta de voz. En el estado actual el agente no firma, no envia transacciones y no mueve fondos; la capa onchain existe como contrato y tests para el siguiente paso de firma desde wallet.

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
- Viem `2.55.4` para cliente Ethereum
- Wagmi `3.7.1` para conexion de wallet y hooks web3
- `@celo/attribution-tags` `0.3.0` para suffix ERC-8021 en transacciones Celo
- Utilidades UI: `class-variance-authority` `0.7.1`, `clsx` `2.1.1`, `tailwind-merge` `3.6.0` y `tw-animate-css` `1.4.0`
- Testing: Vitest `3.2.4`, Testing Library React `16.3.2`, Testing Library DOM `10.4.1` y jsdom `27.2.0`
- Smoke visual: Playwright `1.61.1`
- Tooling frontend: Biome `2.5.3`, TypeScript `5.9.3`, vite-tsconfig-paths `5.1.4`, React Compiler Babel plugin `1.0.0` y web-vitals `5.3.0`

### Agent

- Node.js `>=24.13.0`
- Fastify `5.10.0`
- Google ADK `1.3.0` y ADK Devtools `1.3.0`
- Google GenAI `2.11.0`
- Google Cloud Text-to-Speech `6.4.1`
- AssemblyAI JS SDK `4.36.3`
- Prisma `7.8.0` y `@prisma/client` `7.8.0`
- Pino `10.3.1`
- x402 v2 scoped packages: `@x402/core`, `@x402/evm`, `@x402/express` y `@x402/fetch` `2.18.0`
- Viem `2.55.4`
- Zod `4.1.13`

### Backend

- Node.js `>=24.13.0`
- Fastify `5.10.0`
- PostgreSQL via `pg` `8.20.0`
- Redis `5.10.0` para sesiones HTTP-only del usuario
- Zod `4.1.13`
- TypeScript `5.9.3`
- Biome `2.5.3`

### Onchain

- Solidity `0.8.28`
- Hardhat `3.0.17`
- Hardhat Toolbox Viem `5.0.1`
- Hardhat Ignition `3.0.6`
- OpenZeppelin Contracts `5.6.1`
- Viem `2.55.4` resuelto en el monorepo (`apps/onchain` declara `^2.30.0`)
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
|   +-- backend
|   |   +-- sql
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

## Diagrama de modulos

```txt
[Browser / Frontend]
  | HTTP auth, contacts, preparations, submissions
  | WebSocket app events
  v
[Backend Fastify] --- [Postgres read model]
  |                 --- [Redis sessions + Pub/Sub]
  | HTTP prepare
  v
[Agent Fastify] --- [AI parser + policy + mandates]
  |                 --- [AssemblyAI STT + Google TTS]
  |
[Injected Wallet] --- [PaymentManager contract] --- [Celo]

[Backend ChainIndexer] .... [Celo RPC HTTP/WSS]
[Backend OutboxWorker] .... [Runtime worker process]
[Backend AI tools] .... [ADK runtime tools]
[x402 packages] .... [x402 facilitator / merchant]
[ERC-8004 metadata] .... [Public agent registry]
```

## Modularidad desacoplada

El repo separa transporte, IA, politica, dominio y blockchain para que cada pieza pueda evolucionar de forma independiente:

- `packages/domain` define schemas y tipos compartidos, sin depender de Fastify, React, SDKs IA ni Celo.
- `packages/celo` concentra constantes publicas de red, tokens y helpers de atribucion.
- `apps/agent/src/modules/ai` interpreta la orden; `modules/policy` decide con reglas deterministicas; `modules/mandates` crea mandatos; `modules/voice` integra STT, introspecciones pregrabadas y TTS.
- `apps/agent/src/server.ts` solo expone HTTP y delega el caso de uso a `modules/payments`.
- `apps/backend` consulta Postgres para usuarios, contactos y aliases; esos aliases se exponen como `keyterms_prompt` para AssemblyAI.
- `apps/backend/src/modules/chain-indexer` contiene clases probadas para decodificar `PaymentExecuted`, hacer backfill por `getLogs`, persistir cursor y reconciliar el read model. No se conectan al arranque hasta configurar RPC/deploy.
- `apps/backend/src/modules/outbox` contiene un worker probado para drenar eventos pendientes y publicarlos por Redis, manteniendo Postgres como fuente de verdad.
- `apps/backend/src/modules/ai-tools` deja herramientas desacopladas para que el agente consulte contexto de usuario, resuelva contactos y lea estado de pagos sin depender de rutas HTTP concretas.
- `apps/frontend` puede consumir el agente por HTTP interno sin tener claves de Gemini, AssemblyAI o wallets autonomas.

La intencion es poder cambiar el proveedor de STT/TTS, el modelo LLM, la politica de aprobacion o la red onchain sin reescribir la experiencia web ni los contratos de dominio.

## Estado actual

El flujo implementado es una prueba integrada de aplicacion, agente IA, backend de usuarios y contrato onchain local. La entrada principal sigue siendo login email/password contra el backend de demo; la conexion wallet-first con `wagmi + viem + injected()` esta documentada en `consideracion-conexion-wallet.md` y ya tiene dependencias instaladas, pero aun no reemplaza la sesion actual.

Lo que funciona hoy:

- `docker-compose.yml` levanta Postgres y Redis.
- `apps/backend` crea/consulta usuarios, guarda contactos, genera `keytermsPrompt`, persiste preparaciones idempotentes, registra `txHash` submitted y emite eventos por WebSocket de aplicacion.
- `apps/backend` incluye modulos testeados no conectados aun para indexacion onchain, draining de outbox y tools IA contra usuarios/contactos/pagos.
- `apps/frontend` muestra login, estado de servicios, captura de microfono, transcripcion, payload de agente, contactos, aliases, wallet injected, ejecucion onchain cuando hay contrato configurado y recibo de voz. El payload de preparacion y el mapeo de eventos realtime estan extraidos como helpers testeados.
- `apps/agent` integra Gemini, AssemblyAI, introspecciones pregrabadas, Google Cloud TTS, politica deterministica y generacion de mandatos.
- `apps/onchain` contiene `PaymentManager`, que valida allowlist de tokens, evita replay por `paymentId` y ejecuta `transferFrom` cuando una wallet lo invoque despues de aprobar allowance.
- `packages/celo` expone helpers de attribution, incluyendo seleccion explicita del codigo asignado por Celo Builders y fallback local valido.

Lo que no esta activo todavia:

- La sesion no se crea por firma de wallet.
- La indexacion real por RPC WSS/HTTP no esta activa hasta configurar RPC, contrato desplegado y bloque inicial. Las clases de decoder/backfill/cursor ya estan probadas con logs falsos.
- La confirmacion onchain persistida no se marca automaticamente; hoy se registra `submitted` y se deja `/reconcile` como borde.
- El worker de outbox no corre como proceso permanente por defecto; esta listo para conectarse cuando se defina topologia de runtime.
- x402 real, ERC-8004 y attribution tag oficial requieren configuracion/submission externa.

## Ciclo de vida de la aplicacion

1. Infraestructura local: `bun run db:up` levanta Postgres y Redis; `bun run db:migrate` aplica tablas, indices y seed de demo.
2. Sesion: el frontend llama `POST /auth/login`; el backend valida password, crea una sesion en Redis y entrega cookie HTTP-only `pp_session`.
3. Perfil operativo: el frontend restaura sesion con `GET /auth/session`, recibe usuario, contactos y `keytermsPrompt`.
4. Contactos y aliases: el usuario registra alias -> wallet en Postgres; el backend devuelve aliases ordenados y los transforma en pistas para AssemblyAI.
5. Voz: el frontend pide `POST /voice/streaming-token`; con ese token abre WebSocket directo contra AssemblyAI y envia PCM 16 kHz desde el browser.
6. Introspeccion: antes de preparar pago, el frontend llama `POST /voice/introspection`; el agente responde un audio pregrabado y una lectura preliminar de intencion.
7. Preparacion persistente: el frontend llama `POST /payments/preparations`; el backend valida sesion/idempotencia y delega la interpretacion a `apps/agent`.
8. Politica: el agente parsea la intencion, resuelve alias, valida token/monto/confianza/allowlist y decide `APPROVED`, `REQUIRES_REVIEW` o `REJECTED`.
9. Mandatos: si la politica lo permite, el agente crea `IntentMandate`, `CheckoutMandate`, `PaymentMandate` y `mandateHash`; el backend guarda el read model y emite `payment.prepared`.
10. Wallet: el usuario conecta una wallet injected; puede vincularla a la sesion con challenge/firma y debe coincidir con `userWallet`.
11. Ejecucion: si `VITE_PAYMENT_MANAGER_ADDRESS` existe, el frontend revisa allowance, pide `approve` exacto si falta y llama `PaymentManager.pay`.
12. Submit: al recibir `txHash`, el frontend llama `POST /payments/:paymentId/submissions`; el backend registra `submitted` y emite `payment.submitted`.
13. Respuesta al usuario: el frontend puede llamar `POST /voice/receipt` para generar TTS. El estado `submitted` significa tx enviada, no confirmacion indexada.

## Requisitos

- Node.js `>=24.13.0`
- Bun `1.3.14`

## Instalacion

```bash
bun install
```

## Desarrollo

Levantar dependencias locales de backend:

```bash
bun run db:up
bun run db:migrate
```

Recrear las dependencias Docker de este monorepo desde cero:

```bash
docker compose down -v --remove-orphans
bun run db:up
bun run db:migrate
```

El repositorio contiene un solo `docker-compose.yml`; este comando elimina los volumenes locales de Postgres y Redis definidos para PayProof.

Ejecutar todas las apps configuradas en Turborepo:

```bash
bun run dev
```

El frontend levanta en `http://localhost:3000`.
El agente interno levanta en `http://127.0.0.1:3001`.
El backend de usuarios levanta en `http://127.0.0.1:3002`.
El nodo Hardhat local levanta en `http://127.0.0.1:8545` cuando Turborepo ejecuta `apps/onchain`.

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
cd apps/backend
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
bun run test:ui-smoke
bun run check-types
bun run check
bun run lint
bun run format
```

`bun run test:ui-smoke` requiere que el frontend este sirviendo en `http://localhost:3000` o que `PLAYWRIGHT_BASE_URL` apunte a otra URL. La primera vez puede requerir instalar Chromium con `bunx playwright install chromium`.

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

Para probar el login local despues de aplicar `apps/backend/sql/001_users_contacts.sql` en Postgres:

- Email: `demo@payproof.local`
- Password: `PayProofDemo2026!`

El backend requiere `DATABASE_URL` para usuarios/contactos y `REDIS_URL` para sesiones.

### Frontend

Las variables del cliente deben usar el prefijo `VITE_`. Actualmente el frontend valida:

- `VITE_APP_TITLE`
- `VITE_AGENT_URL`
- `VITE_BACKEND_URL`
- `VITE_DEFAULT_CHAIN`
- `VITE_PAYMENT_MANAGER_ADDRESS`
- `VITE_WALLETCONNECT_PROJECT_ID` cuando se habilite WalletConnect
- `VITE_CELO_NETWORK` cuando se habilite seleccion de red
- `VITE_CELO_ATTRIBUTION_CODE` cuando se use un codigo de atribucion fijo
- `SERVER_URL`

La configuracion esta en `apps/frontend/src/env.ts`.

### Backend

El backend usa:

- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `BACKEND_HOST`
- `BACKEND_PORT`
- `AGENT_URL`
- `PAYMENT_MANAGER_ADDRESS`
- `REALTIME_EVENT_TTL_SECONDS`
- `WALLET_CHALLENGE_TTL_SECONDS`
- `LOG_LEVEL`

### Agent

El agente usa o preve:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `ASSEMBLYAI_API_KEY`
- `ASSEMBLYAI_TOKEN_TTL_SECONDS`
- `HOST`
- `PORT`
- `LOG_LEVEL`
- `CELO_SEPOLIA_RPC_URL`
- `CELO_MAINNET_RPC_URL`
- `X402_FACILITATOR_URL`
- `AGENT_WALLET_PRIVATE_KEY`
- `AGENT_MAX_PAYMENT_USDC`
- `AGENT_DAILY_BUDGET_USDC`

### Onchain

Hardhat usa:

- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`
- `CELO_SEPOLIA_RPC_URL`
- `CELO_SEPOLIA_PRIVATE_KEY`

Estas variables se consumen desde `apps/onchain/hardhat.config.ts`.

### Configuracion externa pendiente

Estas variables/acciones no se resuelven por codigo local y deben configurarse para una demo publica:

- `CELO_RPC_HTTP_URL` y `CELO_RPC_WS_URL` con proveedor que soporte `eth_subscribe`.
- `PAYMENT_MANAGER_ADDRESS`, `VITE_PAYMENT_MANAGER_ADDRESS` y bloque de deployment.
- `CHAIN_INDEXER_START_BLOCK`, confirmaciones y lookback de reorg.
- Attribution tag oficial `celo_...` de Celo Builders.
- Wallets fondeadas: deployer, usuario demo, merchant y agente x402.
- URLs publicas con soporte WebSocket persistente.
- Registro ERC-8004 y endpoint x402 real si se presenta ese track.

## Contratos

La capa onchain incluye:

- `PaymentManager`: contrato relevante para PayProof; ejecuta `transferFrom` de un token permitido desde la wallet firmante hacia el receptor, con replay protection por `paymentId`.
- `TestErc20`: token auxiliar para pruebas locales.
- `Counter`: contrato de ejemplo de Hardhat que se conserva para pruebas base del scaffold.

## Notas de organizacion

- `apps/frontend` contiene la experiencia web, la integracion con TanStack, wallet y BFF ligero.
- `apps/agent` contiene el servicio interno del agente de pagos por voz.
- `apps/onchain` contiene contratos, configuracion de red, tests y despliegues.
- `packages/domain` contiene tipos y schemas compartidos sin dependencias de UI, blockchain o infraestructura.
- `packages/celo` contiene configuracion publica de Celo, tokens y helpers de attribution tags.
