# Onchain

Capa de contratos inteligentes de `idefy`, construida con Hardhat 3, Solidity y Viem.

## Stack

Versiones resueltas en `bun.lock`, salvo Solidity que viene de `hardhat.config.ts`:

- Solidity `0.8.28`
- Hardhat `3.0.17`
- Hardhat Toolbox Viem `5.0.1`
- Hardhat Ignition `3.0.6`
- Viem `2.41.2` resuelto en el monorepo (`package.json` declara `^2.30.0`)
- TypeScript `5.8.3`
- `node:test`
- `forge-std` declarado como `foundry-rs/forge-std#v1.9.4` y resuelto a `1eea5ba` para tests Solidity compatibles con Foundry

## Estructura

```txt
.
+-- contracts
|   +-- Counter.sol
|   +-- Counter.t.sol
+-- ignition
|   +-- modules
|       +-- Counter.ts
+-- scripts
|   +-- send-op-tx.ts
+-- test
|   +-- Counter.ts
+-- hardhat.config.ts
+-- package.json
```

## Desarrollo local

Levantar un nodo Hardhat local:

```bash
bun run dev
```

El script ejecuta:

```bash
hardhat node
```

## Tests

Ejecutar todos los tests:

```bash
bunx hardhat test
```

Ejecutar solo tests Solidity:

```bash
bunx hardhat test solidity
```

Ejecutar solo tests TypeScript con `node:test`:

```bash
bunx hardhat test nodejs
```

## Deploy

Desplegar el modulo Ignition en una red local/simulada:

```bash
bunx hardhat ignition deploy ignition/modules/Counter.ts
```

Desplegar en Sepolia:

```bash
bunx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```

## Redes

Las redes estan configuradas en `hardhat.config.ts`:

- `hardhatMainnet`: red EDR simulada tipo L1.
- `hardhatOp`: red EDR simulada tipo OP.
- `sepolia`: red HTTP L1.

Para Sepolia se requieren:

- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`

Se pueden definir como variables de entorno o mediante el mecanismo de config variables de Hardhat.

## Contrato actual

`contracts/Counter.sol` expone:

- `x`: contador publico.
- `inc()`: incrementa en `1`.
- `incBy(uint by)`: incrementa por `by` y revierte si `by` es `0`.
- `Increment(uint by)`: evento emitido en cada incremento.

El modulo `ignition/modules/Counter.ts` despliega `Counter` y ejecuta una llamada inicial a `incBy(5)`.
