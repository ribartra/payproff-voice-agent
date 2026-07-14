# Frontend

Aplicacion web de `idefy`, construida con React, Vite y TanStack Start.

## Stack

- React `19`
- Vite
- TanStack Start
- TanStack Router con rutas basadas en archivos
- TanStack Query
- Tailwind CSS `4`
- Biome
- Vitest
- Testing Library
- shadcn/ui config
- Lucide React
- T3 Env y Zod
- Viem

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
