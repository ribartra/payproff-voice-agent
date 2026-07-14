# Frontend

Aplicacion web de `idefy`, construida con React, Vite y TanStack Start.

## Stack

Versiones resueltas en `bun.lock` para este workspace:

- React `19.2.1` y React DOM `19.2.1`
- Vite `7.2.6` con `@vitejs/plugin-react` `5.1.1`
- TanStack Start `1.139.14`
- TanStack Router `1.139.16` con rutas basadas en archivos
- TanStack Router Devtools `1.139.15` y Router Plugin `1.139.14`
- TanStack Query `5.90.12` y Query Devtools `5.91.1`
- Tailwind CSS `4.1.17` con `@tailwindcss/vite` `4.1.17`
- Biome `2.2.4`
- TypeScript `5.9.2`
- Vitest `3.2.4`
- Testing Library React `16.3.0`, Testing Library DOM `10.4.1` y jsdom `27.2.0`
- shadcn/ui configurado con estilo `new-york`, Tailwind CSS v4 y Lucide como libreria de iconos
- Lucide React `0.544.0`
- T3 Env Core `0.13.8` y Zod `4.1.13`
- Viem `2.41.2`
- vite-tsconfig-paths `5.1.4`
- React Compiler Babel plugin `1.0.0`
- Utilidades UI: `class-variance-authority` `0.7.1`, `clsx` `2.1.1`, `tailwind-merge` `3.4.0` y `tw-animate-css` `1.4.0`
- web-vitals `5.1.0`

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

## Variables de entorno

La validacion esta en `src/env.ts` usando T3 Env y Zod.

Variables actuales:

- `VITE_APP_TITLE`: variable opcional disponible en cliente.
- `SERVER_URL`: variable opcional de servidor.

Las variables expuestas al cliente deben usar el prefijo `VITE_`.

## Web3

El cliente Viem esta en `src/lib/viem.ts`. Actualmente crea un `PublicClient` para `mainnet` usando el provider inyectado en `globalThis.ethereum` cuando esta disponible.

## UI

El proyecto tiene configuracion shadcn/ui en `components.json`, con estilo `new-york`, Tailwind CSS v4 y Lucide como libreria de iconos.
