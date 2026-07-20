# Frontend

Aplicacion web de PayProof, construida con React, Vite y TanStack Start.

## Stack

Versiones resueltas en `bun.lock` para este workspace:

- React `19.2.7` y React DOM `19.2.7`
- Vite `7.2.6` con `@vitejs/plugin-react` `5.1.1`
- TanStack Start `1.139.14`
- TanStack Router `1.139.16` con rutas basadas en archivos
- TanStack Router Devtools `1.139.15` y Router Plugin `1.139.14`
- TanStack Query `5.90.12` y Query Devtools `5.91.1`
- Tailwind CSS `4.1.17` con `@tailwindcss/vite` `4.1.17`
- Biome `2.5.3`
- TypeScript `5.9.3`
- Vitest `3.2.4`
- Testing Library React `16.3.2`, Testing Library DOM `10.4.1` y jsdom `27.2.0`
- shadcn/ui configurado con estilo `new-york`, Tailwind CSS v4 y Lucide como libreria de iconos
- Lucide React `0.544.0`
- T3 Env Core `0.13.11` y Zod `4.1.13`
- Viem `2.55.4`
- Wagmi `3.7.1`
- `@celo/attribution-tags` `0.3.0`
- Paquetes internos `@payproof/domain` y `@payproof/celo`
- vite-tsconfig-paths `5.1.4`
- React Compiler Babel plugin `1.0.0`
- Utilidades UI: `class-variance-authority` `0.7.1`, `clsx` `2.1.1`, `tailwind-merge` `3.6.0` y `tw-animate-css` `1.4.0`
- web-vitals `5.3.0`

## Estructura

```txt
src
+-- components
+-- data
+-- integrations
|   +-- tanstack-query
+-- lib
+-- routes
+-- env.ts
+-- router.tsx
+-- routeTree.gen.ts
+-- styles.css
```

## Desarrollo

Desde esta carpeta:

```bash
bun run dev
```

La app corre en `http://localhost:3000`.

Desde la raiz del monorepo tambien se puede ejecutar:

```bash
bun run dev
```

## Scripts

```bash
bun run dev      # servidor de desarrollo
bun run build    # build de produccion
bun run serve    # preview del build
bun run test     # tests con Vitest
bun run check-types # typecheck con tsc
bun run check    # Biome check
bun run lint     # Biome lint
bun run format   # Biome format
```

## Rutas

Las rutas viven en `src/routes`. TanStack Router genera `src/routeTree.gen.ts` a partir de esos archivos.

Archivos principales:

- `src/routes/__root.tsx`: documento raiz, metadata, estilos globales, header y devtools.
- `src/routes/index.tsx`: pantalla inicial.
- `src/routes/demo/*`: ejemplos de TanStack Start, SSR, API routes y TanStack Query.

## Estado y datos

TanStack Query se configura en `src/integrations/tanstack-query/root-provider.tsx` y se conecta al router desde `src/router.tsx`.

## Diagrama de modulos

```txt
[src/routes/index.tsx]
  | HTTP auth, contacts, preparations, submissions
  v
[Backend API]

[src/routes/index.tsx]
  | HTTP voice token, introspection, receipt
  v
[Agent API]

[src/routes/index.tsx] --- [src/lib/payment-flow.ts]
[src/routes/index.tsx] --- [src/lib/wagmi.ts]
[src/lib/wagmi.ts] --- [Injected wallet]
[Injected wallet] --- [PaymentManager contract]
[src/routes/index.tsx] --- [AssemblyAI streaming WebSocket]
[src/routes/index.tsx] --- [Backend /ws]

[src/lib/viem.ts] .... [Main payment flow]
[VITE_CELO_ATTRIBUTION_CODE] .... [Payment calldata suffix]
[WalletConnect] .... [Wallet provider runtime]
```

## Ciclo de vida de la pantalla actual

1. Al montar, `src/routes/index.tsx` llama `GET /auth/session` con cookie incluida.
2. Si no hay sesion, muestra login de demo con email/password.
3. Si el login es valido, guarda en estado local usuario, contactos y keyterms devueltos por el backend.
4. La pantalla principal muestra estado de agent/backend, captura de voz, transcript editable, payload que se enviara al agente, resultado de politica, TTS y administracion de contactos.
5. Al guardar un contacto, el frontend llama `POST /users/:userId/contacts` y luego refresca contactos y keyterms en paralelo.
6. Al iniciar microfono, pide token temporal al agente, abre WebSocket de AssemblyAI, envia PCM 16 kHz y acumula turns finales en el transcript.
7. Al preparar pago, primero pide introspeccion pregrabada y luego llama `POST /payments/preparations` en backend.
8. El backend persiste idempotentemente la preparacion y devuelve el read model con el `PreparePaymentResponse`.
9. El usuario puede conectar wallet injected, vincularla por firma, ejecutar `approve` exacto y llamar `PaymentManager.pay` si `VITE_PAYMENT_MANAGER_ADDRESS` existe.
10. Al obtener `txHash`, el frontend registra `submitted` en backend y espera receipt local para feedback de UX.
11. Al generar recibo, envia el `PreparePaymentResponse` a `POST /voice/receipt` y reproduce el audio base64.

## Ciclo de vida DApp actual y previsto

El provider Wagmi ya esta cableado en `src/integrations/tanstack-query/root-provider.tsx` y su configuracion vive en `src/lib/wagmi.ts`. El flujo actual conserva login email/password para perfil/contactos, y usa wallet injected para vincular cuenta y ejecutar pagos cuando hay contrato configurado.

1. Conectar wallet inyectada con `wagmi` y red Celo Sepolia/Celo.
2. Pedir challenge al backend.
3. Firmar challenge con la wallet.
4. Verificar firma en backend y vincular esa wallet al usuario de sesion.
5. Verificar que `address` conectada coincida con `userWallet`.
6. Preparar pago por voz/chat.
7. Validar `paymentMandate`.
8. Pedir `approve` exacto si falta allowance.
9. Ejecutar `PaymentManager.pay` desde la wallet.
10. Registrar el `txHash` en backend y esperar confirmacion indexada cuando el RPC WSS este configurado.

Wallet-first como reemplazo del login queda posterior.

## Variables de entorno

La validacion esta en `src/env.ts` usando T3 Env y Zod.

Variables actuales:

- `VITE_APP_TITLE`: variable opcional disponible en cliente.
- `VITE_WALLETCONNECT_PROJECT_ID`: prevista para WalletConnect.
- `VITE_CELO_NETWORK`: prevista para seleccionar Celo Sepolia o Mainnet.
- `VITE_CELO_ATTRIBUTION_CODE`: prevista para fijar attribution tags Celo.
- `SERVER_URL`: variable opcional de servidor.
- `VITE_AGENT_URL`: URL del agent.
- `VITE_BACKEND_URL`: URL del backend.
- `VITE_DEFAULT_CHAIN`: `celo-sepolia` o `celo`.
- `VITE_PAYMENT_MANAGER_ADDRESS`: contrato habilitado para ejecucion onchain.

Las variables expuestas al cliente deben usar el prefijo `VITE_`.

## Web3

El cliente Viem legacy esta en `src/lib/viem.ts`. La conexion de wallet de la pantalla principal usa Wagmi desde `src/lib/wagmi.ts` con `injected()`, Celo Sepolia, Celo Mainnet y transportes HTTP.

La pantalla usa hooks de Wagmi para conectar/desconectar, cambiar de red, firmar challenge, leer allowance, pedir `approve`, ejecutar `PaymentManager.pay` y esperar receipt local. `@celo/attribution-tags` esta instalado; el suffix real debe agregarse al calldata cuando exista el codigo oficial de Celo Builders.

## Realtime

La pantalla abre `GET /ws` despues de restaurar sesion. Si recibe eventos de contacto, refresca contactos y `keytermsPrompt`. Si el socket cae, reconecta con backoff corto; el snapshot HTTP sigue siendo la fuente de recuperacion.

La logica testeable vive en `src/lib/payment-flow.ts`:

- `buildPaymentRequestPayload()` arma el DTO enviado a `POST /payments/preparations`.
- `shouldRefreshSnapshotFromEvent()` decide si un evento realtime debe refrescar contactos, pagos o sesion.

## UI

El proyecto tiene configuracion shadcn/ui en `components.json`, con estilo `new-york`, Tailwind CSS v4 y Lucide como libreria de iconos.
