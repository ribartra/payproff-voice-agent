# Onchain

Capa de contratos inteligentes de PayProof, construida con Hardhat 3, Solidity y Viem.

## Stack

Versiones resueltas en `bun.lock`, salvo Solidity que viene de `hardhat.config.ts`:

- Solidity `0.8.28`
- Hardhat `3.0.17`
- Hardhat Toolbox Viem `5.0.1`
- Hardhat Ignition `3.0.6`
- Viem `2.55.4` resuelto en el monorepo (`package.json` declara `^2.30.0`)
- TypeScript `5.9.3`
- Biome `2.5.3`
- `node:test`
- `forge-std` declarado como `foundry-rs/forge-std#v1.9.4` y resuelto a `1eea5ba` para tests Solidity compatibles con Foundry

## Estructura

```txt
.
+-- contracts
|   +-- Counter.sol
|   +-- Counter.t.sol
|   +-- PaymentManager.sol
|   +-- TestErc20.sol
+-- ignition
|   +-- modules
|       +-- Counter.ts
|       +-- PaymentManager.ts
+-- scripts
|   +-- send-op-tx.ts
+-- test
|   +-- Counter.ts
|   +-- PaymentManager.ts
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
bunx hardhat ignition deploy ignition/modules/PaymentManager.ts
```

Desplegar en Sepolia o Celo Sepolia:

```bash
bunx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
bunx hardhat ignition deploy --network celoSepolia ignition/modules/PaymentManager.ts
```

## Redes

Las redes estan configuradas en `hardhat.config.ts`:

- `hardhatMainnet`: red EDR simulada tipo L1.
- `hardhatOp`: red EDR simulada tipo OP.
- `sepolia`: red HTTP L1.
- `celoSepolia`: red HTTP para Celo Sepolia.

Para redes externas se requieren:

- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`
- `CELO_SEPOLIA_RPC_URL`
- `CELO_SEPOLIA_PRIVATE_KEY`

Se pueden definir como variables de entorno o mediante el mecanismo de config variables de Hardhat.

## Diagrama de modulos

```txt
[Hardhat tests] --- [PaymentManager.sol]
[Hardhat tests] --- [TestErc20.sol]
[Ignition PaymentManager module] --- [PaymentManager.sol]

[Frontend wallet] --- [ERC20 approve]
[Frontend wallet] --- [PaymentManager.pay]
[PaymentManager.pay] --- [ERC20 transferFrom]
[PaymentManager.pay] --- [PaymentExecuted event]

[Backend ChainIndexer] .... [PaymentExecuted event]
[Celo Sepolia/Mainnet deploy] .... [PaymentManager address]
[ERC-8021 attribution suffix] .... [Frontend calldata]
```

## Contratos actuales

`contracts/PaymentManager.sol` es el contrato relevante para PayProof:

- Recibe en constructor una lista de tokens permitidos.
- `pay(bytes32 paymentId, bytes32 mandateHash, address token, address recipient, uint256 amount)` llama `safeTransferFrom(msg.sender, recipient, amount)`.
- Rechaza `paymentId` duplicado, token no permitido, recipient cero, monto cero y hashes cero.
- Emite `PaymentExecuted(paymentId, mandateHash, payer, token, recipient, amount)`.
- No custodia fondos y no mantiene balances internos.
- Implementa proteccion de replay onchain por `paymentId` mediante `executedPaymentIds`.

`contracts/TestErc20.sol` se usa para pruebas locales del flujo ERC-20.

`contracts/Counter.sol` queda como contrato de ejemplo de Hardhat:

- `x`: contador publico.
- `inc()`: incrementa en `1`.
- `incBy(uint by)`: incrementa por `by` y revierte si `by` es `0`.
- `Increment(uint by)`: evento emitido en cada incremento.

El modulo `ignition/modules/Counter.ts` despliega `Counter` y ejecuta una llamada inicial a `incBy(5)`.

## Ciclo de vida onchain esperado

1. El agente prepara un `PaymentMandate` con `payer`, `payee`, `tokenAddress`, `amountBaseUnits`, `chainId` y `mandateHash`.
2. El frontend valida que la wallet conectada sea `payer` y que la red coincida con `chainId`.
3. El frontend consulta allowance del token hacia `PaymentManager`.
4. Si allowance es insuficiente, la wallet firma `approve(PaymentManager, amount)`.
5. La wallet firma `PaymentManager.pay(paymentId, mandateHash, token, payee, amount)`.
6. El contrato transfiere USDC desde `msg.sender` al receptor usando `transferFrom`.
7. El frontend espera receipt y muestra `txHash`.
8. El frontend registra `txHash` en backend; la confirmacion automatica requiere indexador/RPC WSS configurado.

## Relacion con backend/indexador

El evento `PaymentExecuted` es el contrato entre onchain y backend. El modulo `apps/backend/src/modules/chain-indexer` ya puede decodificar ese evento y probar backfill con logs falsos. Para hacerlo operativo faltan:

- desplegar `PaymentManager`;
- configurar `PAYMENT_MANAGER_ADDRESS`;
- definir `CHAIN_INDEXER_START_BLOCK`;
- configurar RPC HTTP/WSS;
- correr el indexador como proceso runtime.

Hasta entonces el contrato esta probado localmente, pero el backend solo llega automaticamente hasta estado `submitted`.
