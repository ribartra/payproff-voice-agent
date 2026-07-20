# PayProof — No-Coding To-Do para completar la hackathon de Celo

## Propósito de este archivo

Este documento contiene únicamente acciones manuales, de configuración, operación, registro, despliegue y entrega. Los cambios de código viven en `coding-to-so.md`.

**Deadline oficial usado:** 3 de agosto de 2026, 09:00 GMT, equivalente a **3 de agosto, 04:00 a. m. de Perú**.

**Deadline interno:** 2 de agosto de 2026, 08:00 p. m. de Perú. Después de esa hora solo se permiten correcciones críticas de enlaces o configuración.

---

## Corrección conceptual incorporada en esta revisión

El WebSocket no hace que Celo mine o confirme una transacción más rápido. Su función será:

1. escuchar con baja latencia los eventos emitidos por `PaymentManager`;
2. actualizar una vista indexada en Postgres sin obligar al frontend a consultar repetidamente la blockchain;
3. enviar al navegador cambios de estado como `submitted`, `confirmed` o `failed`;
4. sincronizar cambios de perfil, contactos y aliases entre pestañas o dispositivos conectados.

La escritura de una transacción seguirá este camino:

```text
Frontend -> wallet del usuario -> RPC -> Celo
```

La lectura reactiva seguirá este camino:

```text
Celo -> RPC WebSocket -> indexador backend -> Postgres -> WebSocket de aplicación -> frontend
```

Para evitar pérdida de información, Postgres será persistente y el WebSocket será solo transporte. No se usará una base en memoria como fuente de verdad.

---

## Alcance final recomendado

### Track principal — Most Revenue Generated

PayProof debe ejecutar pagos reales de stablecoins en Celo, usando el attribution tag ERC-8021 asignado por Celo Builders.

### Track secundario — Most x402 Payments

El agente puede comprar mediante x402 una factura o recurso de merchant antes de preparar el pago principal. Solo se presenta este track si existe un settlement real y verificable.

### Identidad y submission

- Google ADK se mantiene como framework del agente.
- El agente debe registrarse mediante ERC-8004 para obtener un enlace público.
- El proyecto debe registrarse con Celo Builders para obtener el tag `celo_...`.
- La aplicación debe ser pública, reproducible y mover fondos reales.

### Decisión de autenticación y wallets

- Se conserva inicialmente el login actual por email/password para perfil, usuarios, contactos y aliases.
- Para ejecutar el pago se conecta una wallet inyectada, por ejemplo MetaMask o MiniPay.
- La wallet conectada debe coincidir con la wallet vinculada al usuario, o vincularse mediante firma.
- El reemplazo total del login por wallet-first queda como integración posterior.
- WalletConnect y RainbowKit quedan posteriores a la entrega si `injected()` funciona correctamente.

---

# P0 — Registro y decisiones que bloquean todo lo demás

## 1. Congelar identidad pública del proyecto

- [ ] Confirmar nombre: **PayProof Voice Agent**.
- [ ] Confirmar descripción de una línea:

> Agente de pagos por voz que interpreta órdenes, aplica políticas determinísticas, recupera información pagada mediante x402 y ejecuta pagos verificables en stablecoins sobre Celo.

- [ ] Confirmar URL pública del repositorio.
- [ ] Hacer público el repositorio.
- [ ] Añadir licencia MIT, salvo que el formulario indique otra licencia.
- [ ] Eliminar `.env`, claves privadas, cookies, credenciales y dumps de datos.
- [ ] Revisar el historial Git para confirmar que ningún secreto haya sido commiteado anteriormente.
- [ ] Definir Telegram handle y cuenta de X que se usarán en la submission.

**Salida:** nombre, descripción, repo, Telegram y X están definidos y no cambiarán durante la última semana.

## 2. Registrar el proyecto en Celo Builders

Desde la raíz del repositorio:

```bash
npx skills add https://celobuilders.xyz
```

Entregar al flujo de registro:

- [ ] Nombre del proyecto.
- [ ] URL pública de GitHub.
- [ ] Telegram handle.

Guardar como evidencia:

- [ ] Attribution tag asignado con formato `celo_...`.
- [ ] Captura o respuesta del registro.
- [ ] Fecha y hora del registro.
- [ ] URL del leaderboard.

**Regla:** solo el tag asignado recibe crédito. Un código propio puede conservarse junto al asignado, pero nunca reemplazarlo.

## 3. Confirmar red y reglas de contabilización

- [ ] Confirmar con organizadores si los tracks 1 y 2 cuentan únicamente Celo Mainnet.
- [ ] Confirmar cómo el facilitator x402 atribuye settlements.
- [ ] Confirmar si `approve` necesita o no attribution tag; el pago principal sí debe llevarlo.
- [ ] Guardar capturas de cualquier respuesta oficial.

**Decisión por defecto:** Sepolia para desarrollo; Mainnet con montos mínimos para evidencia final.

---

# P0 — Topología, RPC y WebSockets

## 4. Elegir proveedor RPC con HTTP y WebSocket

Se necesitan dos endpoints para cada red utilizada:

```text
CELO_RPC_HTTP_URL
CELO_RPC_WS_URL
```

Acciones:

- [ ] Confirmar HTTP RPC para Celo Sepolia.
- [ ] Confirmar WSS RPC para Celo Sepolia.
- [ ] Confirmar HTTP RPC para Celo Mainnet.
- [ ] Confirmar WSS RPC para Celo Mainnet.
- [ ] Verificar que el proveedor soporte `eth_subscribe` para logs.
- [ ] Verificar límites de conexiones, desconexiones y rate limits.
- [ ] Mantener HTTP como mecanismo de backfill y reconciliación cuando falle WSS.
- [ ] No exponer URLs autenticadas del RPC al repositorio.

**Nota operativa:** si se usa Forno, preparar reconexión y backfill porque sus conexiones WebSocket pueden cerrarse periódicamente.

## 5. Definir topología pública

URLs mínimas:

```text
https://app.<dominio>       frontend
https://api.<dominio>       backend HTTP + WebSocket de aplicación
https://agent.<dominio>     Google ADK, voz y x402 client
https://merchant.<dominio>  endpoint x402, si se separa
```

- [ ] Elegir hosting que permita conexiones WebSocket persistentes.
- [ ] Confirmar que el proxy soporte `Upgrade: websocket`.
- [ ] Configurar timeouts mayores al heartbeat definido por la aplicación.
- [ ] Confirmar TLS válido para HTTPS/WSS.
- [ ] Evitar serverless que congele o cierre conexiones largas, salvo soporte explícito.
- [ ] Para la hackathon usar una sola instancia del backend si simplifica la operación.
- [ ] Si se levantan varias instancias, confirmar Redis Pub/Sub compartido para fan-out.

## 6. Configurar variables de operación del indexador

Preparar en el hosting, sin commitear secretos:

```text
CELO_RPC_HTTP_URL=
CELO_RPC_WS_URL=
PAYMENT_MANAGER_ADDRESS=
CHAIN_INDEXER_START_BLOCK=
CHAIN_CONFIRMATIONS_REQUIRED=
CHAIN_REORG_LOOKBACK_BLOCKS=
REALTIME_WS_PATH=/ws
REALTIME_HEARTBEAT_SECONDS=25
```

- [ ] Definir `CHAIN_INDEXER_START_BLOCK` como el bloque de deployment del contrato.
- [ ] Definir confirmaciones esperadas para demo y para estado final.
- [ ] Definir un pequeño lookback para detectar duplicados o reorganizaciones.
- [ ] Registrar estas decisiones en README sin publicar credenciales.

---

# P0 — Datos, sesiones, usuarios y aliases

## 7. Preparar Postgres y Redis

- [ ] Crear Postgres administrado o persistente.
- [ ] Crear Redis para sesiones y distribución efímera de eventos.
- [ ] Aplicar migraciones de usuarios/contactos.
- [ ] Aplicar migraciones nuevas de pagos, eventos, cursor del indexador y outbox.
- [ ] Verificar backup básico de Postgres.
- [ ] Confirmar que Redis no sea la única copia de transacciones ni contactos.
- [ ] Configurar retención corta de logs y prohibir audio o secretos en logs.

## 8. Mantener el login actual durante el MVP

- [ ] Crear un usuario demo nuevo para producción/staging.
- [ ] No reutilizar la contraseña pública del README.
- [ ] Asociar una wallet de demo al usuario.
- [ ] Confirmar que la cookie sea `Secure`, `HttpOnly` y con `SameSite` apropiado.
- [ ] Probar login, refresh de sesión y logout desde el dominio público.

**Posterior:** sustituir este login por challenge/firma de wallet solo después de estabilizar el pago real y el canal de eventos.

## 9. Preparar usuarios, contactos y aliases de demo

Crear datos ficticios reproducibles:

- [ ] Usuario demo con wallet asociada.
- [ ] Alias `cafeteria` hacia la wallet merchant.
- [ ] Alias `maria-demo` hacia una wallet de prueba.
- [ ] Token preferido por contacto.
- [ ] `keytermsPrompt` actualizado para AssemblyAI.
- [ ] Caso con alias desconocido.
- [ ] Caso con contacto actualizado desde otra pestaña.

Probar manualmente:

1. [ ] Abrir dos pestañas autenticadas.
2. [ ] Crear o actualizar un contacto en una pestaña.
3. [ ] Comprobar que la otra pestaña recibe el cambio por WebSocket sin recarga.
4. [ ] Recargar y comprobar que el snapshot HTTP coincide con Postgres.

---

# P0 — Wallets y fondos

## 10. Separar wallets por responsabilidad

| Wallet | Función | Ubicación de firma |
|---|---|---|
| `DEPLOYER_WALLET` | Desplegar `PaymentManager` | Hardhat/Ignition |
| `USER_DEMO_WALLET` | Aprobar y pagar desde la UI | Wallet inyectada |
| `AGENT_X402_WALLET` | Micropagos autónomos x402 | Solo `apps/agent` |
| `MERCHANT_PAYTO_WALLET` | Recibir pagos | Fuera del cliente |

- [ ] No usar wallets personales con fondos relevantes.
- [ ] Mantener balances mínimos.
- [ ] Definir presupuesto del agente.
- [ ] Respaldar claves de forma segura.
- [ ] Nunca mostrar seed o private key durante la demo.

Valores iniciales sugeridos:

```text
AGENT_MAX_PAYMENT_USDC=0.05
AGENT_DAILY_BUDGET_USDC=0.50
```

## 11. Conseguir fondos y validar direcciones

- [ ] CELO de faucet en Sepolia para gas.
- [ ] Stablecoin de prueba compatible.
- [ ] CELO mínimo en Mainnet.
- [ ] USDC o USDm mínimo para pago real.
- [ ] Transferencia manual pequeña para validar red, token, decimales y explorer.
- [ ] Confirmar que `USER_DEMO_WALLET` sea la wallet registrada en el perfil demo.

---

# P0 — Proveedores IA y voz

## 12. Google ADK, Gemini y TTS

- [ ] Proyecto de Google seleccionado.
- [ ] Gemini API habilitada y con cuota suficiente.
- [ ] Cuenta de servicio TTS separada para deployment.
- [ ] Credenciales de desarrollo y producción separadas.
- [ ] Prueba de interpretación de orden en español.
- [ ] Prueba de recibo TTS desde estado persistido.
- [ ] Fallback textual listo si TTS falla.

## 13. AssemblyAI

- [ ] API key de producción configurada.
- [ ] Token temporal funciona desde el dominio público.
- [ ] Micrófono permitido por HTTPS.
- [ ] Aliases de demo reconocidos.
- [ ] Entrada por texto disponible como fallback.

---

# P1 — Contrato, indexación y pago real

## 14. Desplegar `PaymentManager`

Cuando el código y tests estén listos:

- [ ] Ejecutar suite local con Hardhat.
- [ ] Desplegar en Celo Sepolia.
- [ ] Guardar dirección, bloque de deployment y tx hash.
- [ ] Configurar el indexador desde ese bloque.
- [ ] Ejecutar un pago Sepolia.
- [ ] Verificar que el evento `PaymentExecuted` aparezca en Postgres.
- [ ] Verificar que la UI cambie a `confirmed` mediante WebSocket.
- [ ] Desplegar la versión final en Mainnet.
- [ ] Verificar el contrato en explorer si está disponible.
- [ ] Guardar commit/tag exacto del código desplegado.

## 15. Probar reconexión y backfill del indexador

- [ ] Iniciar backend/indexador.
- [ ] Ejecutar una transacción y comprobar recepción inmediata.
- [ ] Cortar temporalmente la conexión WSS.
- [ ] Ejecutar otra transacción.
- [ ] Restaurar WSS.
- [ ] Comprobar que el indexador recupera eventos faltantes por HTTP `getLogs`.
- [ ] Confirmar que no duplica `(chainId, txHash, logIndex)`.
- [ ] Reiniciar backend y comprobar que continúa desde el cursor persistido.

**Condición de salida:** la actualización rápida funciona, pero la integridad no depende de que el socket permanezca abierto.

## 16. Conectar wallet para ejecución

Para la entrega mínima:

- [ ] Probar `injected()` con MetaMask.
- [ ] Probar MiniPay si está disponible.
- [ ] Confirmar dirección y red antes del pago.
- [ ] Confirmar que la wallet conectada coincide con la asociada al usuario demo.
- [ ] Probar cambio de cuenta y cambio de red.
- [ ] Probar rechazo de firma.
- [ ] Probar reconexión tras recarga.

**Integración posterior:** crear `VITE_WALLETCONNECT_PROJECT_ID`, WalletConnect y RainbowKit solo si el flujo inyectado ya está estable.

## 17. Verificar attribution ERC-8021

Probar y guardar evidencia para:

- [ ] `PaymentManager.pay`.
- [ ] Transferencia directa, si existe en la demo.
- [ ] Settlement x402, según el mecanismo oficial.
- [ ] `approve`, solo si se decide taggearlo.

Para cada transacción:

- [ ] Tx hash.
- [ ] Explorer URL.
- [ ] Resultado de `verifyTx` cuando aplique.
- [ ] Evidencia en leaderboard o Dune.

**Bloqueo:** no grabar video final hasta que el pago principal sea visible con el tag asignado.

---

# P1 — x402 y autonomía controlada

## 18. Configurar endpoint merchant x402

- [ ] Definir endpoint público.
- [ ] Definir `payTo`.
- [ ] Definir precio mínimo.
- [ ] Definir asset y red.
- [ ] Crear factura ficticia `INV-001`.
- [ ] Confirmar que una llamada sin pago retorna HTTP 402.
- [ ] Confirmar que una llamada pagada retorna HTTP 200.
- [ ] Confirmar que la respuesta incluye hash o firma verificable.

## 19. Validar wallet autónoma del agente

- [ ] Cargar fondos mínimos.
- [ ] Confirmar allowlist de host/path.
- [ ] Confirmar máximo por request.
- [ ] Confirmar presupuesto diario.
- [ ] Ejecutar una compra x402 real.
- [ ] Guardar request ID, precio, payer, `payTo`, response hash y settlement tx.
- [ ] Confirmar que el mismo invoice no se paga dos veces por reintento.

---

# P1 — ERC-8004

## 20. Preparar metadata pública

- [ ] Nombre y descripción.
- [ ] Logo público estable.
- [ ] URL de aplicación.
- [ ] URL del repositorio.
- [ ] Endpoint del agente.
- [ ] Wallet asociada.
- [ ] Capacidades: voz, contactos/aliases, política, Celo y x402.

## 21. Registrar agente

- [ ] Registrar en el flujo oficial.
- [ ] Guardar `agentId`.
- [ ] Guardar registry address y tx hash.
- [ ] Guardar URL pública de 8004scan/explorer.
- [ ] Abrir enlace en incógnito.

---

# P1 — Ensayo funcional de punta a punta

## 22. Escenario principal

Comando sugerido:

> Paga la factura INV-001 de la cafetería usando USDC.

El ensayo debe demostrar:

1. [ ] Login de usuario y carga inicial HTTP de perfil/contactos.
2. [ ] Canal WebSocket de aplicación conectado.
3. [ ] Conexión de wallet inyectada.
4. [ ] Orden por voz o texto.
5. [ ] Google ADK interpreta y llama tools.
6. [ ] Alias `cafeteria` resuelto desde Postgres.
7. [ ] Compra opcional de factura mediante x402.
8. [ ] Política determinística.
9. [ ] Confirmación humana.
10. [ ] `approve` exacto si hace falta.
11. [ ] Envío de `PaymentManager.pay` con attribution tag.
12. [ ] UI muestra `submitted` al conocer el tx hash.
13. [ ] Indexador escucha `PaymentExecuted`.
14. [ ] Backend persiste el evento.
15. [ ] Frontend recibe `payment.confirmed` por WebSocket.
16. [ ] Recibo visual y TTS desde estado persistido.
17. [ ] Explorer y tag verificables.

## 23. Escenarios de resiliencia

- [ ] Alias desconocido.
- [ ] Monto sobre límite.
- [ ] Usuario rechaza firma.
- [ ] Wallet en red incorrecta.
- [ ] Allowance insuficiente.
- [ ] Transacción revertida.
- [ ] Recarga con transacción pendiente.
- [ ] WebSocket de aplicación desconectado y reconectado.
- [ ] RPC WSS desconectado y backfill posterior.
- [ ] Contacto actualizado desde otra pestaña.
- [ ] Reintento con misma idempotency key.

---

# P2 — Evidencias y entrega

## 24. README público final

Debe incluir:

- [ ] Problema y propuesta de valor.
- [ ] Por qué es un agente.
- [ ] Arquitectura command/event.
- [ ] Diferencia entre RPC HTTP, RPC WSS y WebSocket de aplicación.
- [ ] Postgres como fuente persistente.
- [ ] Google ADK y tools.
- [ ] Flujo de usuarios, contactos y aliases.
- [ ] Flujo de pago y contrato.
- [ ] Indexador y recuperación ante desconexión.
- [ ] ERC-8021.
- [ ] ERC-8004.
- [ ] x402.
- [ ] Contratos, wallets públicas y tx hashes.
- [ ] URLs públicas.
- [ ] Instrucciones de reproducción.
- [ ] Limitaciones y roadmap: wallet-first auth y WalletConnect.

## 25. Video de demostración

Duración sugerida: 3 a 5 minutos.

Guion:

1. problema y solución;
2. arquitectura breve;
3. login y contactos;
4. conectar wallet;
5. orden por voz;
6. interpretación/política/x402;
7. firma y envío;
8. actualización rápida por evento WebSocket;
9. explorer, attribution y ERC-8004;
10. cierre con tracks.

Revisar:

- [ ] Sin private keys ni secretos.
- [ ] Sin correos personales.
- [ ] Subtítulos.
- [ ] Enlaces públicos.
- [ ] Mostrar que el estado confirmado viene del backend/indexador, no de una animación local.

## 26. Publicación en X

- [ ] Etiquetar `@CeloDevs` y `@Celo`.
- [ ] Incluir una línea sobre PayProof.
- [ ] Incluir enlace ERC-8004.
- [ ] Incluir demo o repo.
- [ ] Guardar URL del post.

## 27. Submission final

Ejecutar:

```bash
npx skills add https://celobuilders.xyz
```

Luego:

```text
Help me submit my project to the Celo Agentic Payments & DeFAI Hackathon.
```

Tener listos:

- [ ] Nombre y descripción.
- [ ] Repo.
- [ ] App pública.
- [ ] Video.
- [ ] Post de X.
- [ ] ERC-8004.
- [ ] Attribution tag.
- [ ] Contract address.
- [ ] Tx hashes.
- [ ] Track 1.
- [ ] Track 2, solo si está verificado.
- [ ] x402 endpoint y wallet `payTo`.
- [ ] Wallet del agente cuando el formulario la solicite.

- [ ] Revisar draft.
- [ ] Publicar.
- [ ] Abrir confirmación en incógnito.
- [ ] Guardar URL y captura.

---

# Cronograma propuesto — hora de Perú

| Fecha | Resultado esperado |
|---|---|
| 19–20 julio | Registro, tag, red, RPC HTTP/WSS y topología definidos |
| 20–22 julio | Postgres/Redis, usuarios/contactos de demo y proveedores configurados |
| 22–25 julio | Contrato Sepolia, indexador y WebSocket de aplicación operativos |
| 25–27 julio | Wallet inyectada, pago Sepolia, attribution y reconciliación |
| 27–29 julio | x402 y ERC-8004 |
| 29–30 julio | Mainnet controlado y evidencias onchain |
| 30 julio–1 agosto | Resiliencia, README, video y post de X |
| 2 agosto antes de 8:00 p. m. | Submission final |
| 3 agosto, 4:00 a. m. | Deadline oficial; no planificar desarrollo aquí |

---

# Checklist de completitud no-coding

- [ ] Proyecto registrado y attribution tag asignado.
- [ ] Reglas de red confirmadas.
- [ ] RPC HTTP y WSS configurados.
- [ ] Hosting soporta WebSocket de aplicación.
- [ ] Postgres y Redis desplegados.
- [ ] Login demo y datos ficticios preparados.
- [ ] Contactos/aliases sincronizados entre pestañas.
- [ ] Wallets separadas y fondeadas mínimamente.
- [ ] Contrato final desplegado.
- [ ] Indexador sobrevive desconexión y reinicio.
- [ ] Pago real aparece en Postgres y frontend por evento.
- [ ] Attribution tag visible.
- [ ] x402 verificable, si se presenta Track 2.
- [ ] ERC-8004 público.
- [ ] App, repo y video públicos.
- [ ] Post de X publicado.
- [ ] Submission confirmada.

---

# Integraciones posteriores a la entrega

- Wallet-first como reemplazo completo de email/password.
- WalletConnect.
- RainbowKit.
- Multi-wallet y smart accounts.
- Separar el indexador como microservicio independiente.
- Escalado horizontal del WebSocket gateway.
- Memberships o credenciales NFT.
- Bots de Discord/Telegram autenticados por firma.
- Askbots y Aigora, salvo que el núcleo ya esté completo.

---

# Estado externo despues de la implementacion desacoplada

Ya no bloquean el coding local, porque hay clases y tests sin dependencias externas:

- decoder y backfill de `PaymentExecuted`;
- `ChainIndexer` con cursor;
- worker de outbox;
- tools IA para usuario/contacto/estado de pago;
- helpers frontend de payload/realtime;
- helper de attribution suffix.

Siguen siendo tareas manuales o de configuracion:

- obtener el attribution tag oficial `celo_...` mediante Celo Builders;
- definir `CELO_RPC_HTTP_URL`, `CELO_RPC_WS_URL`, `PAYMENT_MANAGER_ADDRESS`, `CHAIN_INDEXER_START_BLOCK`, confirmaciones y lookback;
- desplegar `PaymentManager` en Sepolia/Mainnet y guardar address/bloque inicial;
- fondear wallets separadas de deployer, usuario demo, merchant y agente x402;
- configurar hosting que soporte WebSocket persistente;
- decidir como correr el outbox worker e indexer en runtime;
- registrar ERC-8004 y publicar metadata;
- configurar x402 facilitator/merchant/payTo si se presenta Track 2;
- revisar historial Git y secretos antes de hacer publico el repo.
