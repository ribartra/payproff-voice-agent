# Celo

Paquete compartido para configuracion publica de Celo, tokens y helpers de attribution tags.

## Stack

- TypeScript `5.9.3`
- Viem `2.55.4`
- `@celo/attribution-tags` `0.3.0`
- Biome `2.5.3`

## Contenido

- `CELO_CHAINS`: Celo Mainnet y Celo Sepolia.
- `CELO_TOKENS`: USDC y USDm para mainnet/testnet.
- `attributionSuffixFromHostname()`
- `attributionSuffixFromCode()`
- `builderAttributionSuffix()`: prioriza el codigo oficial asignado por Celo Builders y acepta un fallback local valido.

## Diagrama de modulos

```txt
[CELO_CHAINS] --- [Agent health]
[CELO_CHAINS] --- [Frontend network validation]
[CELO_TOKENS] --- [Agent mandates]
[CELO_TOKENS] --- [Frontend allowance/payment validation]
[attributionSuffixFromCode] --- [builderAttributionSuffix]

[builderAttributionSuffix] .... [Frontend writeContract calldata]
[Celo Builders official code] .... [Runtime env]
[RPC provider config] .... [CELO_CHAINS defaults]
```

## Ciclo de vida de uso

1. El agent usa `CELO_CHAINS` para reportar chain ids soportados en `/health`.
2. La capa de mandatos usa `CELO_TOKENS` para resolver `tokenAddress` segun red y simbolo.
3. El frontend/onchain pueden usar los mismos valores para validar red, token y decimales antes de firmar.
4. Los helpers de attribution tags preparan suffix ERC-8021 para transacciones Celo cuando se active ejecucion desde wallet.
5. `builderAttributionSuffix()` debe usarse cuando exista el tag oficial `celo_...`; el fallback local solo sirve para desarrollo.

Este paquete solo contiene constantes publicas y helpers deterministas. No guarda claves, no crea clientes con secretos y no envia transacciones.

## Scripts

```bash
bun run build
bun run test
bun run check
bun run check-types
bun run lint
bun run format
```
