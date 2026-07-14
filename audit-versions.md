Revisé las versiones resueltas indicadas en los tres README y las comparé con los releases disponibles al **14 de julio de 2026**. El repositorio está relativamente actualizado, pero hay varios saltos mayores que no conviene aplicar todos juntos.   

## Problema inmediato: la versión mínima de Node es incorrecta

El README establece:

```text
Node.js >=18
```

Esto ya no es compatible con el stack actual:

* Hardhat 3 requiere **Node.js 22.13 o superior**.
* TanStack Start reciente requiere Node 22.12 o superior.
* Vite 7 y Vite 8 requieren Node 20.19 o 22.12 en adelante.
* El futuro `apps/agent` con Google ADK requiere Node 24.13 o superior.

Hardhat declara oficialmente que Hardhat 3 se lanzó para Node `22.13.0+`. ([Hardhat][1])

Debe cambiarse a:

```json
{
  "engines": {
    "node": ">=24.13.0",
    "bun": ">=1.3.3"
  }
}
```

Así unifican frontend, Hardhat y Google ADK bajo un runtime soportado.

# Saltos drásticos que pueden romper compatibilidad

| Tecnología                 |        Actual |  Disponible | Riesgo        | Recomendación                          |
| -------------------------- | ------------: | ----------: | ------------- | -------------------------------------- |
| **TypeScript**             | 5.9.2 / 5.8.3 |       7.0.2 | 🔴 Muy alto   | No actualizar directamente             |
| **Vite**                   |         7.2.6 |       8.1.4 | 🔴 Alto       | Migración separada                     |
| **`@vitejs/plugin-react`** |         5.1.1 |       6.0.3 | 🔴 Alto       | Actualizar con Vite 8                  |
| **Vitest**                 |         3.2.4 |      4.1.10 | 🔴 Alto       | Revisar mocks, pools y coverage        |
| **jsdom**                  |        27.2.0 |      29.1.1 | 🟠 Medio-alto | Actualizar después de Vitest           |
| **Lucide React**           |       0.544.0 |      1.24.0 | 🟠 Medio-alto | Revisar imports e iconos renombrados   |
| **vite-tsconfig-paths**    |         5.1.4 |       6.1.1 | 🟠 Medio      | Probar resolución de aliases           |
| **forge-std**              |         1.9.4 |      1.16.2 | 🟠 Medio      | Ejecutar todos los tests Solidity      |
| **Solidity**               |        0.8.28 |      0.8.36 | 🟠 Medio      | Recompilar, comparar bytecode y probar |
| **TanStack Start/Router**  |       1.139.x | 1.168–1.170 | 🟠 Medio      | Actualizar el conjunto coordinadamente |

## 1. TypeScript 5 → 7: el salto más peligroso

TypeScript 7 no es una actualización normal. Es un **port nativo escrito en Go**, con una mejora de rendimiento de aproximadamente 8 a 12 veces, pero cambia la arquitectura del compilador. TypeScript 7.0 además no incluye todavía una API programática compatible; Microsoft indica que esa nueva API llegará en TypeScript 7.1. ([Microsoft for Developers][2])

También hereda los cambios de TypeScript 6:

* `strict: true` por defecto.
* `module: esnext`.
* `types: []`.
* Cambio del valor predeterminado de `rootDir`.
* Eliminación de `baseUrl`.
* Eliminación de `moduleResolution: node`.
* Eliminación de targets y módulos antiguos.
* Algunos flags pasan de deprecated a error.
* Herramientas que importen `typescript` como API pueden dejar de funcionar.

Para la hackathon recomiendo:

```text
Actual:
root       5.9.2
onchain    5.8.3

Objetivo inmediato:
todo       5.9.3
```

No migraría todavía a TypeScript 7. Primero se debe estabilizar PayProof y comprobar que TanStack Start, Hardhat, React Compiler y cualquier generador funcionan con el nuevo compilador.

## 2. Vite 7 → 8

Vite 8 reemplaza la arquitectura anterior basada en esbuild y Rollup por **Rolldown**, un bundler unificado escrito en Rust. El propio equipo lo describe como el cambio arquitectónico más importante desde Vite 2. ([vitejs][3])

Riesgos:

* Plugins que dependan de comportamiento interno de Rollup.
* Configuración `build.rollupOptions`.
* Transformaciones personalizadas.
* SSR de TanStack Start.
* Diferencias en orden de módulos y chunks.
* Integración del React Compiler.

Vite proporciona una capa de compatibilidad, pero recomienda migrar progresivamente. También confirma que `@vitejs/plugin-react` v6 utiliza Oxc y deja de incluir Babel por defecto. ([vitejs][3])

Ruta segura:

```text
1. Mantener plugin-react 5.
2. Migrar Vite 7 → Vite 8.
3. Ejecutar build, SSR y tests.
4. Migrar plugin-react 5 → 6.
5. Revisar React Compiler.
```

Vite confirma que `plugin-react` v5 todavía puede funcionar con Vite 8, permitiendo separar ambos cambios. ([vitejs][3])

## 3. Vitest 3 → 4

Vitest 4 elimina y modifica varias APIs:

* Requiere Node 20+ y Vite 6+.
* Cambia el sistema de coverage V8.
* Elimina `coverage.all`.
* Elimina `coverage.extensions`.
* Cambia mocks, `restoreAllMocks` y snapshots.
* Reemplaza internamente `vite-node`.
* Cambia configuración de pools.
* `maxThreads` y `maxForks` pasan a `maxWorkers`.
* Elimina varias opciones deprecated.
* Cambia Browser Mode.

La guía oficial documenta explícitamente estos cambios. ([vitest.dev][4])

No debe actualizarse junto con Vite 8. El orden recomendado es:

```text
Vite 8
→ validar build
→ Vitest 4
→ actualizar configuración
→ jsdom 29
```

## 4. jsdom 27 → 29

La versión disponible es jsdom `29.1.1`. ([GitHub][5])

Aunque jsdom es una dependencia de testing, puede cambiar:

* Serialización del DOM.
* `getComputedStyle()`.
* Eventos.
* Cookies y URLs.
* Snapshots.
* Comportamiento CSS.

Debe actualizarse después de Vitest 4 y ejecutar todos los tests de Testing Library.

## 5. Lucide React 0.x → 1.x

Lucide ya está en la serie `1.x`; el release actual revisado es `1.24.0`. ([GitHub][6])

Pasar de `0.544.0` a `1.24.0` es un salto mayor semántico. Aunque muchos imports podrían seguir funcionando, deben revisar:

* Iconos eliminados o renombrados.
* Aliases deprecated.
* Cambios visuales en SVG.
* Tree shaking.
* Imports dinámicos.
* Componentes shadcn que importen iconos antiguos.

No es prioritario para el MVP. Puede mantenerse `0.544.0` mientras se implementa la funcionalidad.

# Inventario completo

## Monorepo y tooling

| Tecnología      | Actual | Disponible | Riesgo     | Acción                     |
| --------------- | -----: | ---------: | ---------- | -------------------------- |
| Bun             |  1.3.3 |     1.3.14 | Bajo       | Actualizar                 |
| Turborepo       |  2.6.3 |     2.10.5 | Bajo-medio | Actualizar y validar caché |
| TypeScript raíz |  5.9.2 |      7.0.2 | Muy alto   | Subir solo a 5.9.3         |
| Biome raíz      |  2.3.8 |      2.5.3 | Bajo-medio | Actualizar                 |
| Biome frontend  |  2.2.4 |      2.5.3 | Bajo-medio | Unificar con raíz          |

Bun `1.3.14` es el release actual revisado. ([GitHub][7])

### Inconsistencia actual de Biome

Tienen dos versiones:

```text
raíz:       2.3.8
frontend:   2.2.4
```

Esto puede causar diferencias entre:

```bash
bun run check
```

ejecutado desde raíz y desde `apps/frontend`.

Debe existir una sola versión:

```text
@biomejs/biome 2.5.3
```

preferiblemente declarada en la raíz.

## Frontend principal

| Tecnología             | Actual | Disponible | Riesgo  | Acción                            |
| ---------------------- | -----: | ---------: | ------- | --------------------------------- |
| React                  | 19.2.1 |     19.2.7 | Bajo    | Actualizar                        |
| React DOM              | 19.2.1 |     19.2.7 | Bajo    | Actualizar junto con React        |
| Vite                   |  7.2.6 |      8.1.4 | Alto    | Migración controlada              |
| `@vitejs/plugin-react` |  5.1.1 |      6.0.3 | Alto    | Después de Vite 8                 |
| React Compiler plugin  |  1.0.0 |      1.0.0 | Ninguno | Mantener                          |
| vite-tsconfig-paths    |  5.1.4 |      6.1.1 | Medio   | Evaluar si sigue siendo necesario |
| web-vitals             |  5.1.0 |      5.3.0 | Bajo    | Actualizar                        |

React `19.2.7` es la versión actual publicada en el registro. ([registry.npmjs.org][8])

Vite 8 incluye soporte nativo opcional para rutas de `tsconfig`:

```ts
resolve: {
  tsconfigPaths: true,
}
```

Por tanto, durante la migración se puede evaluar eliminar completamente `vite-tsconfig-paths`, en lugar de saltar de v5 a v6. Vite documenta esta capacidad como novedad de Vite 8. ([vitejs][3])

## TanStack

| Tecnología      |   Actual | Disponible | Riesgo | Acción                  |
| --------------- | -------: | ---------: | ------ | ----------------------- |
| TanStack Start  | 1.139.14 |   1.168.28 | Medio  | Actualizar en conjunto  |
| React Router    | 1.139.16 |   1.170.18 | Medio  | Actualizar en conjunto  |
| Router Devtools | 1.139.15 |    1.167.0 | Medio  | Actualizar en conjunto  |
| Router Plugin   | 1.139.14 |   1.168.20 | Medio  | Actualizar en conjunto  |
| React Query     |  5.90.12 |    5.101.2 | Bajo   | Actualizar              |
| Query Devtools  |   5.91.1 |    5.101.2 | Bajo   | Igualar con React Query |

Aunque TanStack mantiene el mismo major, el salto entre `1.139` y `1.168/1.170` es grande. No deben ejecutar:

```bash
bun update @tanstack/react-router
```

de forma aislada.

Actualicen el bloque completo:

```text
@tanstack/react-start
@tanstack/react-router
@tanstack/react-router-devtools
@tanstack/router-plugin
```

y después regeneren:

```text
routeTree.gen.ts
```

## CSS y UI

| Tecnología               |  Actual | Disponible | Riesgo     | Acción                          |
| ------------------------ | ------: | ---------: | ---------- | ------------------------------- |
| Tailwind CSS             |  4.1.17 |      4.3.2 | Bajo-medio | Actualizar                      |
| `@tailwindcss/vite`      |  4.1.17 |      4.3.2 | Bajo-medio | Igualar con Tailwind            |
| Lucide React             | 0.544.0 |     1.24.0 | Medio-alto | Postergar                       |
| T3 Env Core              |  0.13.8 |    0.13.11 | Bajo       | Actualizar                      |
| Zod                      |  4.1.13 |      4.4.3 | Bajo-medio | Actualizar y ejecutar typecheck |
| class-variance-authority |   0.7.1 |      0.7.1 | Ninguno    | Mantener                        |
| clsx                     |   2.1.1 |      2.1.1 | Ninguno    | Mantener                        |
| tailwind-merge           |   3.4.0 |      3.6.0 | Bajo       | Actualizar                      |
| tw-animate-css           |   1.4.0 |      1.4.0 | Ninguno    | Mantener                        |

Tailwind y `@tailwindcss/vite` deben conservar exactamente la misma versión.

## Web3 frontend

| Tecnología |       Actual |     Disponible | Riesgo | Acción                               |
| ---------- | -----------: | -------------: | ------ | ------------------------------------ |
| Viem       |       2.41.2 |         2.55.2 | Medio  | Actualizar coordinadamente           |
| wagmi      | No instalado | Debe agregarse | Nuevo  | Instalar cuando se implemente wallet |

Viem no cambia de major, pero el proyecto dependerá de comportamiento específico de Celo:

* Serialización de transacciones.
* EIP-712.
* `feeCurrency`.
* `dataSuffix` para Attribution Tags.
* Receipts.
* Chain definitions.

Por eso deben ejecutar pruebas reales en Celo Sepolia después de actualizarlo.

## Testing

| Tecnología            | Actual | Disponible | Riesgo     | Acción             |
| --------------------- | -----: | ---------: | ---------- | ------------------ |
| Vitest                |  3.2.4 |     4.1.10 | Alto       | Migración separada |
| Testing Library React | 16.3.0 |     16.3.2 | Bajo       | Actualizar         |
| Testing Library DOM   | 10.4.1 |     10.4.1 | Ninguno    | Mantener           |
| jsdom                 | 27.2.0 |     29.1.1 | Medio-alto | Después de Vitest  |
| React Compiler plugin |  1.0.0 |      1.0.0 | Ninguno    | Mantener           |

## Onchain

| Tecnología           | Actual | Disponible | Riesgo     | Acción               |
| -------------------- | -----: | ---------: | ---------- | -------------------- |
| Solidity             | 0.8.28 |     0.8.36 | Medio      | Actualizar con tests |
| Hardhat              | 3.0.17 |      3.9.1 | Medio      | Actualizar en bloque |
| Hardhat Toolbox Viem |  5.0.1 |      5.0.7 | Bajo-medio | Actualizar en bloque |
| Hardhat Ignition     |  3.0.6 |      3.1.8 | Medio      | Actualizar en bloque |
| Viem                 | 2.41.2 |     2.55.2 | Medio      | Igualar monorepo     |
| TypeScript onchain   |  5.8.3 |      7.0.2 | Alto       | Unificar en 5.9.3    |
| forge-std            |  1.9.4 |     1.16.2 | Medio      | Actualizar y probar  |

Solidity `0.8.36` es el release más reciente revisado; incluye correcciones importantes y soporte para la futura versión EVM Amsterdam. ([GitHub][9])

`forge-std` está actualmente en `1.16.2`, frente al `1.9.4` declarado en el proyecto. ([GitHub][10])

### Hardhat debe actualizarse como unidad

No actualizar únicamente Hardhat. El bloque debe ser:

```text
hardhat
@nomicfoundation/hardhat-toolbox-viem
@nomicfoundation/hardhat-ignition
viem
forge-std
```

Después se debe ejecutar:

```bash
bunx hardhat clean
bunx hardhat compile
bunx hardhat test
bunx hardhat test solidity
bunx hardhat test nodejs
```

# Qué actualizar ahora

Actualizaciones de bajo riesgo:

```text
Bun                    1.3.3   → 1.3.14
React                  19.2.1  → 19.2.7
React DOM              19.2.1  → 19.2.7
Turborepo              2.6.3   → 2.10.5
Biome                  2.2/2.3 → 2.5.3
T3 Env                 0.13.8  → 0.13.11
Testing Library React  16.3.0  → 16.3.2
tailwind-merge         3.4.0   → 3.6.0
web-vitals             5.1.0   → 5.3.0
```

Actualizaciones coordinadas:

```text
TanStack Start + Router + Plugin + Devtools
TanStack Query + Query Devtools
Tailwind + @tailwindcss/vite
Hardhat + Toolbox + Ignition + Viem
Solidity + forge-std
```

Actualizaciones que postergaría hasta después del MVP:

```text
TypeScript 7
Vite 8
plugin-react 6
Vitest 4
jsdom 29
Lucide React 1
vite-tsconfig-paths 6
```

# Orden recomendado

```text
1. Corregir Node >=18 → Node >=24.13.
2. Unificar TypeScript en 5.9.3.
3. Unificar Biome en 2.5.3.
4. Aplicar patches y minors de bajo riesgo.
5. Actualizar TanStack como bloque.
6. Actualizar Hardhat/Viem/Solidity como bloque.
7. Terminar el vertical de Celo Sepolia.
8. Crear una rama exclusiva para Vite 8.
9. Migrar Vitest 4 y jsdom 29.
10. Evaluar TypeScript 7 después de la hackathon.
```

La recomendación práctica para PayProof es **no perseguir todas las últimas versiones antes de construir el flujo de pago**. El stack actual es suficiente; primero corregiría Node, las versiones duplicadas y los paquetes menores. Los saltos TypeScript 7, Vite 8 y Vitest 4 deben tratarse como migraciones independientes, cada una con su propio commit y ejecución completa de pruebas.

[1]: https://hardhat.org/docs/reference/nodejs-support "Node.js support | Hardhat 3"
[2]: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ "Announcing TypeScript 7.0 - TypeScript"
[3]: https://vite.dev/blog/announcing-vite8 "Vite 8.0 is out! | Vite"
[4]: https://vitest.dev/guide/migration.html "Migration Guide | Guide | Vitest"
[5]: https://github.com/jsdom/jsdom/releases/latest "Release v29.1.1 · jsdom/jsdom · GitHub"
[6]: https://github.com/lucide-icons/lucide/releases/latest "Release Version 1.24.0 · lucide-icons/lucide · GitHub"
[7]: https://github.com/oven-sh/bun/releases/latest "Release Bun v1.3.14 · oven-sh/bun · GitHub"
[8]: https://registry.npmjs.org/react/latest "registry.npmjs.org"
[9]: https://github.com/ethereum/solidity/releases/latest "Release Version 0.8.36 · argotorg/solidity · GitHub"
[10]: https://github.com/foundry-rs/forge-std/releases/latest "Release v1.16.2 · foundry-rs/forge-std · GitHub"

