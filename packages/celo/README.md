# Celo

Paquete compartido para configuracion publica de Celo, tokens y helpers de attribution tags.

## Stack

- TypeScript `5.9.3`
- Viem `2.41.2`
- `@celo/attribution-tags` `0.3.0`
- Biome `2.5.3`

## Contenido

- `CELO_CHAINS`: Celo Mainnet y Celo Sepolia.
- `CELO_TOKENS`: USDC y USDm para mainnet/testnet.
- `attributionSuffixFromHostname()`
- `attributionSuffixFromCode()`

## Scripts

```bash
bun run build
bun run test
bun run check
bun run check-types
bun run lint
bun run format
```
