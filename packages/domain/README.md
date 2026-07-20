# Domain

Paquete compartido para schemas y tipos de PayProof que no dependen de React, Viem, Fastify, Prisma ni ADK.

## Stack

- TypeScript `5.9.3`
- Zod `4.1.13`
- Biome `2.5.3`

## Contenido

- `paymentIntentSchema`
- `paymentStateSchema`
- `policyDecisionSchema`
- `parsedPaymentIntentSchema`
- `intentMandateSchema`
- `checkoutMandateSchema`
- `paymentMandateSchema`
- `preparePaymentRequestSchema`
- `preparePaymentResponseSchema`
- `paymentSubmissionRequestSchema`
- `paymentExecutionRequestSchema`
- `preparedPaymentRecordSchema`
- `paymentTransactionRecordSchema`
- `chainEventRecordSchema`
- `realtimeEnvelopeSchema`
- `contactRealtimePayloadSchema`
- `userRealtimePayloadSchema`
- `walletChallengeRequestSchema`
- `walletLinkRequestSchema`
- `canonicalJson()`

## Diagrama de modulos

```txt
[preparePaymentRequestSchema] --- [Agent PaymentApplication]
[preparePaymentResponseSchema] --- [Backend payment preparation]
[preparedPaymentRecordSchema] --- [Backend read model]
[paymentSubmissionRequestSchema] --- [Frontend tx submit]
[paymentTransactionRecordSchema] --- [Backend tx read model]
[chainEventRecordSchema] --- [Backend ChainIndexer]
[realtimeEnvelopeSchema] --- [Backend /ws]
[contactRealtimePayloadSchema] --- [Frontend contact refresh]
[walletChallengeRequestSchema] --- [Backend wallet challenge]
[walletLinkRequestSchema] --- [Backend wallet link]

[x402 DTOs] .... [Domain package]
[ERC-8004 DTOs] .... [Domain package]
```

## Ciclo de vida de dominio

1. El frontend construye un `PreparePaymentRequest` con transcript, wallet, red, tokens permitidos, allowlist de aliases, limite e idempotency key.
2. El agent valida ese request con `preparePaymentRequestSchema`.
3. El parser produce un `ParsedPaymentIntent`.
4. La politica produce un `PolicyDecision`.
5. La capa de mandatos produce `IntentMandate`, `CheckoutMandate` y `PaymentMandate`.
6. El agent devuelve `PreparePaymentResponse`.
7. El backend persiste la preparacion como `PreparedPaymentRecord`.
8. El frontend registra `PaymentSubmissionRequest` cuando obtiene `txHash`.
9. El indexador transforma `PaymentExecuted` en `ChainEventRecord`.
10. El backend publica cambios mediante `RealtimeEnvelope`.

Este paquete solo define contratos de datos. No ejecuta HTTP, no consulta Postgres, no llama modelos IA y no toca Celo.

## Scripts

```bash
bun run build
bun run test
bun run check
bun run check-types
bun run lint
bun run format
```
