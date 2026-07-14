# **Proyecto propuesto: PayProof Voice Agent**

**Arquitectura reajustada a partir del repositorio `fabzio/idefy`:** se conserva el concepto real del repositorio —**Bun workspaces \+ Turborepo**, `apps/frontend` con **React 19 \+ Vite \+ TanStack Start**, y `apps/onchain` con **Hardhat 3 \+ Solidity \+ Viem**— y se añade únicamente la capa necesaria para el agente de pagos.

Un agente de pagos por voz para pequeñas empresas, freelancers y equipos operativos:

“Paga 5 USDC al proveedor cuando la factura sea válida, no esté duplicada y el monto esté dentro del presupuesto.”

El sistema:

1. Transcribe la orden con **AssemblyAI**.  
2. Usa **Google ADK \+ Gemini** para interpretar la intención.  
3. Evalúa reglas determinísticas de seguridad.  
4. Genera una autorización inspirada en **AP2**.  
5. Solicita confirmación humana para el pago principal.  
6. Ejecuta una transferencia ERC-20 directa al proveedor o un micropago x402 para consumir una API.  
7. Confirma la transacción en Celo.  
8. Informa el resultado mediante **Google TTS**.

La separación conceptual es:

AssemblyAI       → voz a texto  
Gemini \+ ADK     → interpretación y orquestación  
Motor de reglas  → decisión determinística  
AP2-inspired     → autorización y auditoría  
x402             → pago de APIs/servicios HTTP  
EIP-3009         → autorización criptográfica sin allowance persistente  
TanStack Start   → experiencia web \+ BFF/server functions  
wagmi/viem       → conexión, firma, lectura y envío  
Hardhat 3        → contratos, pruebas y despliegue  
Celo             → liquidación en stablecoins  
Google TTS       → respuesta por voz

---

# **0\. Correcciones derivadas de los README de `idefy`**

La versión anterior trataba al frontend como una SPA de Vite y consideraba obligatorio un backend separado para cualquier endpoint. Eso no representa fielmente al repositorio base.

`idefy` usa **TanStack Start**, no solo TanStack Router. TanStack Start es un framework full-stack sobre Vite y TanStack Router: soporta SSR, server functions y server routes. Por ello:

* `apps/frontend` puede alojar la interfaz y una capa BFF delgada.  
* Los secretos usados por funciones ligeras pueden permanecer en código `.server.ts`.  
* Los endpoints públicos —por ejemplo, el token temporal de AssemblyAI— pueden ser Server Routes.  
* Las acciones internas —como `preparePayment()`— pueden ser Server Functions.  
* **Fastify no es obligatorio para todo el backend.**

Sin embargo, se mantiene un servicio separado `apps/agent` porque **Google ADK para TypeScript requiere Node.js 24.13 o superior** y conviene aislar:

* El runtime del agente.  
* La wallet autónoma de micropagos.  
* La persistencia.  
* La política financiera.  
* La integración x402.  
* Los procesos que pueden durar más que una petición web.

La arquitectura recomendada no reemplaza el repositorio de `idefy`; lo amplía:

idefy original:  
apps/frontend  
apps/onchain

PayProof:  
apps/frontend  
apps/agent       ← nueva capa  
apps/onchain  
packages/domain  ← lógica realmente compartida  
packages/celo    ← configuración y ABI compartidos

## **Decisiones de runtime**

* **Bun 1.4.0:** package manager, workspaces y ejecución de tareas.  
* **Turborepo:** orquestación y caché de `dev`, `build`, `test` y `check`.  
* **Node.js 24.13+:** runtime explícito de `apps/agent`; también satisface el mínimo de Hardhat 3\.  
* **Biome:** lint y formato, conservando la decisión de `idefy`.  
* No se introducen pnpm ni ESLint en paralelo.

Bun puede administrar los workspaces, pero el servicio ADK debe ejecutarse explícitamente bajo Node y no asumir compatibilidad de runtime solo porque sus dependencias fueron instaladas con Bun.

---

# **1\. Arquitectura completa**

┌──────────────────────────────────────────────────────────────────────┐  
│ apps/frontend — TanStack Start \+ React 19 \+ Vite                    │  
│                                                                      │  
│ Browser                                                              │  
│ ├── UI, micrófono y reproducción de audio                            │  
│ ├── TanStack Router / Query                                          │  
│ ├── wagmi \+ viem                                                     │  
│ ├── conexión y cambio de red                                         │  
│ ├── firma de transfer() / EIP-712                                    │  
│ └── seguimiento del receipt                                          │  
│                                                                      │  
│ TanStack Start Server                                                │  
│ ├── Server Functions: prepare/get/submit payment                     │  
│ ├── Server Routes: /api/asr/token y BFF                              │  
│ ├── validación T3 Env \+ Zod                                          │  
│ ├── CSRF y same-origin para acciones internas                        │  
│ └── proxy autenticado hacia apps/agent                               │  
└───────────────────────────────┬──────────────────────────────────────┘  
                                │ HTTP interno  
                                ▼  
┌──────────────────────────────────────────────────────────────────────┐  
│ apps/agent — Node 24.13+ \+ Fastify \+ Google ADK                     │  
│                                                                      │  
│ ├── Gemini / ADK PaymentCoordinatorAgent                             │  
│ ├── motor determinístico de políticas                               │  
│ ├── mandatos AP2-inspired                                            │  
│ ├── x402 buyer \+ recurso protegido                                   │  
│ ├── wallet autónoma con saldo y límites mínimos                      │  
│ ├── verificación de receipts y Attribution Tags                      │  
│ ├── Google TTS                                                       │  
│ └── Prisma \+ PostgreSQL                                              │  
└───────────────────────────────┬──────────────────────────────────────┘  
                                │ viem/RPC  
                                ▼  
┌──────────────────────────────────────────────────────────────────────┐  
│ Celo Sepolia → Celo Mainnet                                         │  
│ USDC / USDm / CELO para gas                                         │  
└───────────────────────────────▲──────────────────────────────────────┘  
                                │ deploy/tests/scripts  
┌───────────────────────────────┴──────────────────────────────────────┐  
│ apps/onchain — Hardhat 3 \+ Solidity 0.8.28 \+ Viem \+ Ignition        │  
│ ├── configuración Celo                                               │  
│ ├── pruebas TypeScript y Solidity                                    │  
│ ├── scripts de verificación                                          │  
│ └── contrato no custodial opcional para anclar mandateHash           │  
└──────────────────────────────────────────────────────────────────────┘

## **Fronteras de responsabilidad**

### **`apps/frontend`**

Puede:

* Capturar audio.  
* Solicitar un token temporal de AssemblyAI desde una Server Route.  
* Mostrar la transcripción.  
* Llamar Server Functions.  
* Conectar la wallet.  
* Solicitar firma.  
* Enviar transacciones.  
* Mostrar receipt y explorer.

No puede:

* Contener claves de AssemblyAI, Gemini o una wallet autónoma.  
* Decidir límites.  
* Resolver direcciones a partir de texto libre.  
* Marcar una operación como confirmada sin verificación del servidor.

### **`apps/agent`**

Puede:

* Interpretar la intención.  
* Aplicar reglas.  
* Crear mandatos.  
* Mantener estado e idempotencia.  
* Ejecutar micropagos x402 con una wallet separada y limitada.  
* Verificar lo ocurrido on-chain.  
* Generar audio TTS.

No debe:

* Firmar el pago principal con la wallet del usuario.  
* Aceptar montos o destinatarios inventados por el LLM.  
* Almacenar una seed phrase en texto plano.

### **`apps/onchain`**

Debe usarse para:

* Configurar Celo Sepolia y mainnet.  
* Verificar contratos y dominios de tokens.  
* Ejecutar pruebas.  
* Desplegar contratos opcionales.  
* Conservar scripts reproducibles de mainnet.

No es necesario crear un contrato custodial para el MVP.

---

# **2\. Stack alineado con `idefy`**

## **Monorepo**

* Bun `1.4.0`  
* Bun workspaces  
* Turborepo  
* TypeScript  
* Biome  
* Node.js `24.13+` como runtime común validado

## **Frontend/BFF: `apps/frontend`**

Se mantiene el stack del README:

* React `19`  
* Vite  
* TanStack Start  
* TanStack Router con rutas basadas en archivos  
* TanStack Query  
* Tailwind CSS `4`  
* shadcn/ui  
* Lucide React  
* T3 Env \+ Zod  
* Vitest \+ Testing Library  
* Viem

Se agregan:

* wagmi  
* WalletConnect e injected connectors  
* AssemblyAI browser streaming  
* Web Audio API  
* `@celo/attribution-tags`

## **Agente: `apps/agent`**

* Node.js `24.13+`  
* Fastify como servidor interno  
* `@google/adk`  
* `@google/adk-devtools` solo para desarrollo  
* `@google/genai`  
* Gemini Flash  
* Zod  
* Prisma \+ PostgreSQL  
* Pino  
* AssemblyAI SDK  
* Gemini TTS  
* viem  
* Cliente/facilitator x402

ADK Web se usa para depuración, no como servidor de producción.

## **Onchain: `apps/onchain`**

Se conserva:

* Solidity `0.8.28`  
* Hardhat `3`  
* Hardhat Toolbox Viem  
* Hardhat Ignition  
* Viem  
* TypeScript  
* `node:test`  
* Pruebas Solidity compatibles con Foundry

Cambios:

* Reemplazar la configuración Ethereum Sepolia por `celoSepolia` y `celoMainnet`.  
* Retirar `Counter` del flujo productivo.  
* Añadir scripts de validación de tokens, EIP-712/EIP-3009 y atribución.  
* Desplegar un contrato propio solo cuando aporte trazabilidad real.

## **Contrato opcional recomendado**

PayProofMandateRegistry.sol

Su responsabilidad sería únicamente:

* Registrar `mandateHash`.  
* Registrar expiración.  
* Asociar el agente o emisor.  
* Emitir `MandateAnchored`.

No debe custodiar fondos ni afirmar que verificó una transferencia externa. El backend continúa verificando `txHash`, evento `Transfer`, token, destinatario y monto.

## **Estructura del repositorio**

payproof/  
├── apps/  
│   ├── frontend/  
│   │   ├── src/  
│   │   │   ├── components/  
│   │   │   │   ├── agent/  
│   │   │   │   ├── payments/  
│   │   │   │   ├── voice/  
│   │   │   │   ├── wallet/  
│   │   │   │   └── ui/  
│   │   │   ├── data/  
│   │   │   │   ├── payment.queries.ts  
│   │   │   │   └── payment.mutations.ts  
│   │   │   ├── integrations/  
│   │   │   │   ├── tanstack-query/  
│   │   │   │   └── wagmi/  
│   │   │   ├── lib/  
│   │   │   │   ├── api/  
│   │   │   │   ├── assemblyai/  
│   │   │   │   ├── celo/  
│   │   │   │   ├── payments/  
│   │   │   │   ├── payments.functions.ts  
│   │   │   │   ├── payments.server.ts  
│   │   │   │   └── schemas/  
│   │   │   ├── routes/  
│   │   │   │   ├── \_\_root.tsx  
│   │   │   │   ├── index.tsx  
│   │   │   │   ├── agent.tsx  
│   │   │   │   ├── payments.index.tsx  
│   │   │   │   ├── payments.$paymentId.tsx  
│   │   │   │   ├── api.asr.token.ts  
│   │   │   │   └── api.health.ts  
│   │   │   ├── env.ts  
│   │   │   ├── router.tsx  
│   │   │   ├── routeTree.gen.ts  
│   │   │   └── styles.css  
│   │   ├── components.json  
│   │   ├── vite.config.ts  
│   │   └── package.json  
│   │  
│   ├── agent/  
│   │   ├── src/  
│   │   │   ├── agent/  
│   │   │   │   ├── payment-coordinator.ts  
│   │   │   │   └── tools/  
│   │   │   ├── modules/  
│   │   │   │   ├── intents/  
│   │   │   │   ├── mandates/  
│   │   │   │   ├── payments/  
│   │   │   │   ├── policy/  
│   │   │   │   ├── receipts/  
│   │   │   │   ├── tts/  
│   │   │   │   └── x402/  
│   │   │   ├── infrastructure/  
│   │   │   │   ├── celo/  
│   │   │   │   ├── database/  
│   │   │   │   ├── logging/  
│   │   │   │   └── security/  
│   │   │   ├── app.ts  
│   │   │   └── server.ts  
│   │   ├── prisma/  
│   │   │   ├── schema.prisma  
│   │   │   └── migrations/  
│   │   └── package.json  
│   │  
│   └── onchain/  
│       ├── contracts/  
│       │   ├── PayProofMandateRegistry.sol  
│       │   └── PayProofMandateRegistry.t.sol  
│       ├── ignition/  
│       │   └── modules/  
│       │       └── PayProofMandateRegistry.ts  
│       ├── scripts/  
│       │   ├── inspect-token.ts  
│       │   ├── verify-eip3009-domain.ts  
│       │   └── verify-deployment.ts  
│       ├── test/  
│       │   └── PayProofMandateRegistry.ts  
│       ├── hardhat.config.ts  
│       └── package.json  
│  
├── packages/  
│   ├── domain/  
│   │   ├── src/  
│   │   │   ├── mandates.ts  
│   │   │   ├── payment-intent.ts  
│   │   │   ├── payment-state.ts  
│   │   │   ├── policy.ts  
│   │   │   └── index.ts  
│   │   └── package.json  
│   └── celo/  
│       ├── src/  
│       │   ├── abis/  
│       │   ├── attribution.ts  
│       │   ├── chains.ts  
│       │   ├── tokens.ts  
│       │   └── index.ts  
│       └── package.json  
│  
├── e2e/  
│   └── payment-flow.spec.ts  
├── biome.json  
├── bun.lock  
├── package.json  
├── turbo.json  
└── README.md

## **Por qué solo dos packages**

El repositorio original todavía no tiene paquetes compartidos y recomienda crearlos cuando aparezca reutilización real. Para PayProof solo se justifican inicialmente:

* `packages/domain`: schemas y estados compartidos.  
* `packages/celo`: cadenas, tokens, ABI y utilidades públicas.

No se deben crear paquetes separados para cada módulo desde el primer día.

## **Reglas de dependencia**

packages/domain  
  └── no importa React, ADK, Prisma, Fastify, wagmi ni viem.

packages/celo  
  └── no contiene claves privadas ni acceso directo a process.env.

apps/frontend  
  └── puede importar domain y celo.  
  └── firma con la wallet del usuario.

apps/agent  
  └── puede importar domain y celo.  
  └── ejecuta políticas, persistencia y micropagos delegados.

apps/onchain  
  └── puede reutilizar ABI/configuración, pero mantiene Hardhat.

## **TanStack Start: server functions y server routes**

Usar Server Functions para operaciones internas y tipadas:

preparePayment()  
getPayment()  
registerSubmittedTransaction()  
requestVoiceReceipt()

Usar Server Routes para endpoints HTTP explícitos:

POST /api/asr/token  
GET  /api/health  
POST /api/x402/callback

Organización:

payments.functions.ts  → createServerFn importables desde React  
payments.server.ts     → lógica server-only y cliente del agent  
payment.schemas.ts     → Zod compartido entre cliente y servidor

## **Flujo de extremo a extremo**

1\. Browser solicita /api/asr/token a TanStack Start.  
2\. TanStack Start genera token temporal con ASSEMBLYAI\_API\_KEY.  
3\. Browser transmite audio directamente a AssemblyAI.  
4\. Browser recibe un turno final y llama preparePayment().  
5\. Server Function valida el input y llama apps/agent por red interna.  
6\. ADK extrae PaymentIntent.  
7\. El motor de políticas crea PolicyDecision y mandateHash.  
8\. TanStack Start devuelve solo datos seguros al navegador.  
9\. El usuario confirma y firma transfer() o EIP-712.  
10\. Browser transmite a Celo y obtiene txHash.  
11\. registerSubmittedTransaction() entrega el hash al agent.  
12\. Agent verifica receipt, evento Transfer, token, monto y atribución.  
13\. PostgreSQL cambia SUBMITTED → CONFIRMED.  
14\. TanStack Query actualiza la vista.  
15\. Agent genera el recibo TTS y el frontend lo reproduce.

## **Modalidades de wallet**

### **Pago principal — humano presente**

wallet del usuario en navegador  
→ confirmación explícita  
→ firma  
→ transferencia al proveedor

No existe private key del usuario en el servidor.

### **Micropago x402 — agente delegado**

wallet separada del agente en apps/agent  
→ balance mínimo  
→ maxValue por request  
→ presupuesto diario  
→ allowlist de recursos  
→ nonce/expiración

Esta modalidad demuestra autonomía real sin entregar al agente acceso ilimitado a los fondos del usuario.

## **Variables de entorno**

### **`apps/frontend/src/env.ts`**

Públicas:

VITE\_APP\_TITLE=PayProof  
VITE\_WALLETCONNECT\_PROJECT\_ID=...  
VITE\_CELO\_NETWORK=celo-sepolia  
VITE\_CELO\_ATTRIBUTION\_CODE=...

Solo servidor TanStack Start:

AGENT\_INTERNAL\_URL=http://agent:3001  
ASSEMBLYAI\_API\_KEY=...  
SERVER\_URL=http://localhost:3000

Una variable sin prefijo `VITE_` no debe accederse desde componentes cliente.

### **`apps/agent`**

GEMINI\_API\_KEY=...  
DATABASE\_URL=postgresql://...  
CELO\_SEPOLIA\_RPC\_URL=...  
CELO\_MAINNET\_RPC\_URL=...  
X402\_FACILITATOR\_URL=...  
AGENT\_WALLET\_PRIVATE\_KEY=...  
AGENT\_MAX\_PAYMENT\_USDC=0.10  
AGENT\_DAILY\_BUDGET\_USDC=1.00

### **`apps/onchain`**

CELO\_SEPOLIA\_RPC\_URL=...  
CELO\_MAINNET\_RPC\_URL=...  
CELO\_DEPLOYER\_PRIVATE\_KEY=...

La clave de despliegue y la wallet x402 deben ser cuentas diferentes.

## **Scripts del monorepo**

bun install  
bun run dev  
bun run build  
bun run test  
bun run check  
bun run lint  
bun run format

Comandos dirigidos:

bun run \--filter frontend dev  
bun run \--filter agent dev  
bun run \--filter onchain dev

bunx hardhat test  
bunx hardhat ignition deploy \--network celoSepolia \\  
  apps/onchain/ignition/modules/PayProofMandateRegistry.ts

El script de `apps/agent` debe ejecutar el proceso explícitamente con Node 24.13 o superior.

## **Estrategia de despliegue**

Public:  
\- apps/frontend / TanStack Start       :3000  
\- endpoint x402 protegido              :443

Private:  
\- apps/agent / Node \+ Fastify          :3001  
\- PostgreSQL                           :5432

Para la hackathon, `apps/frontend` puede proxyar las acciones internas hacia `apps/agent`, evitando exponer el servicio completo.

## **Modo compacto por límite de tiempo**

apps/frontend  
apps/onchain  
packages/domain  
packages/celo

En este modo, ADK se importa en módulos `.server.ts` de TanStack Start y el servidor completo se ejecuta sobre Node 24.13+. Es técnicamente válido, pero aumenta el acoplamiento.

La recomendación principal sigue siendo `apps/agent` separado.

---

# **3\. Celo Sepolia y migración a mainnet**

| Entorno | Chain ID | Uso |
| ----- | ----- | ----- |
| Celo Sepolia | `11142220` | Desarrollo y pruebas |
| Celo Mainnet | `42220` | Demo final y producción |

import { celo, celoSepolia } from "viem/chains";

export const chainConfig \= {  
  testnet: {  
    chain: celoSepolia,  
    chainId: 11142220,  
    rpc: "https://forno.celo-sepolia.celo-testnet.org",  
    explorer: "https://celo-sepolia.blockscout.com",  
  },  
  mainnet: {  
    chain: celo,  
    chainId: 42220,  
    rpc: "https://forno.celo.org",  
    explorer: "https://celoscan.io",  
  },  
} as const;

## **Tokens**

export const SEPOLIA\_TOKENS \= {  
  USDC: {  
    address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",  
    decimals: 6,  
  },  
  USDm: {  
    address: "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b",  
    decimals: 18,  
  },  
} as const;

export const MAINNET\_TOKENS \= {  
  USDC: {  
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",  
    decimals: 6,  
  },  
  USDm: {  
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",  
    decimals: 18,  
  },  
} as const;

Antes de usar un token para EIP-3009 o fee abstraction deben consultar:

name()  
symbol()  
decimals()  
version()  
DOMAIN\_SEPARATOR()

También deben consultar `/supported` en el facilitator x402.

---

# **4\. Wallet, wagmi y viem**

import { createConfig, http } from "wagmi";  
import { celo, celoSepolia } from "wagmi/chains";  
import { injected, walletConnect } from "wagmi/connectors";

const walletConnectProjectId \=  
  import.meta.env.VITE\_WALLETCONNECT\_PROJECT\_ID;

if (\!walletConnectProjectId) {  
  throw new Error("Falta VITE\_WALLETCONNECT\_PROJECT\_ID");  
}

export const wagmiConfig \= createConfig({  
  chains: \[celoSepolia, celo\],  
  connectors: \[  
    injected(),  
    walletConnect({  
      projectId: walletConnectProjectId,  
    }),  
  \],  
  transports: {  
    \[celoSepolia.id\]: http(),  
    \[celo.id\]: http(),  
  },  
});

Estados mínimos:

DISCONNECTED  
CONNECTING  
WRONG\_NETWORK  
CONNECTED  
SIGNATURE\_REQUESTED  
SIGNATURE\_REJECTED

TanStack Router controla navegación, TanStack Query sincroniza el backend y wagmi mantiene el estado de wallet.

---

# **5\. Transferencia ERC-20 directa**

import {  
  createPublicClient,  
  createWalletClient,  
  custom,  
  erc20Abi,  
  http,  
  parseUnits,  
} from "viem";  
import { celoSepolia } from "viem/chains";

export async function transferToken(params: {  
  token: \`0x${string}\`;  
  recipient: \`0x${string}\`;  
  amount: string;  
  decimals: number;  
}) {  
  if (\!window.ethereum) {  
    throw new Error("Wallet no disponible");  
  }

  const walletClient \= createWalletClient({  
    chain: celoSepolia,  
    transport: custom(window.ethereum),  
  });

  const publicClient \= createPublicClient({  
    chain: celoSepolia,  
    transport: http(),  
  });

  const \[account\] \= await walletClient.requestAddresses();  
  const value \= parseUnits(params.amount, params.decimals);

  const { request } \= await publicClient.simulateContract({  
    account,  
    address: params.token,  
    abi: erc20Abi,  
    functionName: "transfer",  
    args: \[params.recipient, value\],  
  });

  const hash \= await walletClient.writeContract(request);

  const receipt \= await publicClient.waitForTransactionReceipt({  
    hash,  
    confirmations: 1,  
  });

  if (receipt.status \!== "success") {  
    throw new Error("La transacción fue revertida");  
  }

  return {  
    hash,  
    receipt,  
    explorer: \`https://celo-sepolia.blockscout.com/tx/${hash}\`,  
  };  
}

Para una transferencia directa no se necesita `approve()`. Solo se usa cuando un contrato gastará tokens mediante `transferFrom()`.

---

# **6\. EIP-3009**

transfer():  
\- El usuario envía la transacción.  
\- El usuario paga gas.

approve() \+ transferFrom():  
\- Se concede permiso a un spender.  
\- El allowance puede permanecer abierto.

transferWithAuthorization():  
\- El usuario firma un mensaje EIP-712.  
\- No crea allowance persistente.  
\- Emplea nonce único.  
\- Tiene validAfter y validBefore.  
\- Un tercero puede presentar y pagar el gas.

type TransferAuthorization \= {  
  from: \`0x${string}\`;  
  to: \`0x${string}\`;  
  value: bigint;  
  validAfter: bigint;  
  validBefore: bigint;  
  nonce: \`0x${string}\`;  
};

La firma debe incluir:

chainId  
verifyingContract  
token  
from  
to  
value  
validAfter  
validBefore  
nonce

---

# **7\. x402**

1\. El agente solicita un recurso.  
2\. El servidor responde HTTP 402\.  
3\. Incluye red, token, monto, destinatario y expiración.  
4\. La wallet firma la autorización.  
5\. El agente repite la solicitud con la prueba.  
6\. El facilitator verifica.  
7\. El facilitator liquida.  
8\. Celo confirma.  
9\. El recurso se entrega.

Para la demo:

x402 \+ facilitator oficial Celo → USDC  
Pago directo / alternativa      → USDm

Defensas mínimas:

quoteId único  
idempotencyKey  
nonce de un solo uso  
expiración corta  
lock por paymentId  
vínculo con method, URL y body hash  
token, monto y destinatario firmados  
settlement antes de liberar el recurso

---

# **8\. AP2-inspired**

type IntentMandate \= {  
  id: string;  
  userWallet: \`0x${string}\`;  
  instruction: string;  
  allowedTokens: ("USDC" | "USDm")\[\];  
  merchantAllowlist: \`0x${string}\`\[\];  
  maxAmount: string;  
  validUntil: string;  
  createdAt: string;  
};

type CheckoutMandate \= {  
  id: string;  
  intentMandateId: string;  
  merchant: \`0x${string}\`;  
  description: string;  
  amount: string;  
  token: "USDC" | "USDm";  
  network: "celo-sepolia" | "celo";  
  expiresAt: string;  
  evidenceHash?: string;  
};

type PaymentMandate \= {  
  id: string;  
  checkoutMandateId: string;  
  payer: \`0x${string}\`;  
  payee: \`0x${string}\`;  
  tokenAddress: \`0x${string}\`;  
  amountBaseUnits: string;  
  chainId: number;  
  authorizationType:  
    | "WALLET\_TRANSACTION"  
    | "EIP3009"  
    | "X402";  
  signedAt?: string;  
  signature?: \`0x${string}\`;  
};

mandateHash \= keccak256(canonicalJSON)

---

# **9\. Google ADK dentro de `apps/agent`**

PaymentCoordinatorAgent  
├── parse\_payment\_intent  
├── resolve\_recipient  
├── validate\_payment\_policy  
├── create\_payment\_mandate  
├── request\_x402\_resource  
├── verify\_transaction  
└── generate\_voice\_receipt

import { FunctionTool, LlmAgent } from "@google/adk";  
import { z } from "zod";

const preparePayment \= new FunctionTool({  
  name: "prepare\_payment",  
  description: "Prepara una propuesta; nunca firma ni mueve fondos.",  
  parameters: z.object({  
    recipientAlias: z.string(),  
    amount: z.string(),  
    token: z.enum(\["USDC", "USDm"\]),  
    reason: z.string(),  
  }),  
  execute: async (input) \=\> {  
    return paymentApplication.prepare(input);  
  },  
});

export const paymentCoordinator \= new LlmAgent({  
  name: "payment\_coordinator",  
  model: "gemini-flash-latest",  
  instruction: \`  
    Nunca inventes direcciones.  
    Nunca cambies montos o tokens después de crear el mandato.  
    Usa prepare\_payment antes de cualquier pago.  
    Una decisión del modelo no equivale a autorización financiera.  
  \`,  
  tools: \[preparePayment\],  
});

ADK no es la fuente de verdad del pago:

ADK session       → contexto conversacional  
Payment table     → estado financiero  
Mandate table     → autorización  
Transaction table → evidencia on-chain

---

# **10\. AssemblyAI**

Browser  
  ├── POST /api/asr/token  
  ├── Server Route usa ASSEMBLYAI\_API\_KEY  
  ├── devuelve token temporal  
  ├── Browser abre WebSocket con AssemblyAI  
  ├── envía PCM mono 16 kHz  
  ├── recibe eventos Turn  
  └── llama preparePayment() solo con end\_of\_turn \= true

La UI debe repetir explícitamente:

“Entendí cinco USDC, no cincuenta. ¿Confirmas?”

---

# **11\. Gemini y Google TTS**

const PaymentIntentSchema \= z.object({  
  recipientAlias: z.string(),  
  amount: z.string(),  
  token: z.enum(\["USDC", "USDm"\]),  
  condition: z.string(),  
  confidence: z.number().min(0).max(1),  
});

No se prepara una transacción cuando:

confidence \< 0.90  
destinatario no resuelto  
monto ambiguo  
token ambiguo

TTS recomendado:

gemini-2.5-flash-preview-tts

Respuesta:

“Pago confirmado. Se transfirieron cinco USDC al proveedor autorizado. La transacción termina en A7F3.”

---

# **12\. Motor de políticas**

type PolicyDecision \=  
  | { status: "APPROVED"; reasons: string\[\] }  
  | { status: "REQUIRES\_REVIEW"; reasons: string\[\] }  
  | { status: "REJECTED"; reasons: string\[\] };

Reglas:

1. Token permitido.  
2. Destinatario permitido.  
3. Monto dentro del límite.  
4. Presupuesto diario disponible.  
5. Mandato vigente.  
6. Operación no duplicada.  
7. Dirección válida.  
8. Saldo suficiente.  
9. Chain ID correcto.  
10. Confirmación humana válida.

paymentId \=  
sha256(  
  payer \+  
  invoiceHash \+  
  recipient \+  
  token \+  
  amount \+  
  expiration  
)

---

# **13\. Máquina de estados**

CAPTURING\_AUDIO  
      ↓  
TRANSCRIBED  
      ↓  
INTENT\_PARSED  
      ↓  
POLICY\_CHECKED  
      ↓  
PAYMENT\_PREPARED  
      ↓  
AWAITING\_CONFIRMATION  
      ↓  
AUTHORIZED  
      ↓  
AWAITING\_WALLET\_SIGNATURE  
      ↓  
SUBMITTED  
      ↓  
CONFIRMED

Estados alternativos:

AMBIGUOUS  
REJECTED  
SIGNATURE\_REJECTED  
WRONG\_NETWORK  
INSUFFICIENT\_FUNDS  
EXPIRED  
REVERTED  
DUPLICATE  
FAILED

---

# **14\. Attribution Tags**

bun add @celo/attribution-tags viem

import { toDataSuffix } from "@celo/attribution-tags";

const attributionCode \=  
  import.meta.env.VITE\_CELO\_ATTRIBUTION\_CODE;

if (\!attributionCode) {  
  throw new Error("Falta VITE\_CELO\_ATTRIBUTION\_CODE");  
}

const dataSuffix \= toDataSuffix(attributionCode);

const hash \= await walletClient.writeContract({  
  address: tokenAddress,  
  abi: erc20Abi,  
  functionName: "transfer",  
  args: \[recipient, amount\],  
  dataSuffix,  
});

El backend verifica la atribución después de recibir el hash.

---

# **15\. Mento y stablecoins**

USDC:  
\- x402 con EIP-3009.  
\- micropagos de API.  
\- mayor compatibilidad con facilitator.

USDm:  
\- pago directo.  
\- feeCurrency.  
\- integración futura con FX de Mento.

COPm / BRLm:  
\- diferenciador LATAM posterior.

No se agregan swaps Mento al MVP inicial.

---

# **16\. Seguridad**

LLM:  
\- No inventa direcciones.  
\- No altera mandatos.  
\- No define límites.

Frontend:  
\- Firma con wallet.  
\- Valida chainId.  
\- Muestra monto, token, destinatario y gas.

Backend:  
\- Secretos server-only.  
\- Idempotencia.  
\- Locks.  
\- Expiración.  
\- Rate limiting.  
\- Logs sin secretos.

Blockchain:  
\- simulateContract.  
\- bigint.  
\- decimals consultados on-chain.  
\- receipt exitoso.  
\- evento Transfer verificado.  
\- atribución verificada.

Wallet autónoma:

cuenta separada  
saldo mínimo  
límite por transacción  
presupuesto diario  
allowlist  
botón de pausa  
revocación

---

# **17\. Roadmap reajustado**

## **Fase 0 — Adaptar `idefy`**

* Crear rama `payproof`.  
* Mantener Bun, Turborepo y Biome.  
* Conservar `apps/frontend` y `apps/onchain`.  
* Añadir `apps/agent`.  
* Añadir `packages/domain` y `packages/celo`.  
* Eliminar demos no usados.  
* Retirar `Counter`.  
* Establecer Node 24.13+.

## **Fase 1 — Vertical blockchain**

* Configurar Celo Sepolia.  
* Conectar wallet.  
* Leer saldo.  
* Simular `transfer()`.  
* Añadir Attribution Tag.  
* Enviar `0.01 USDC`.  
* Verificar receipt y evento.  
* Mostrar Blockscout.

## **Fase 2 — Esqueleto full-stack**

* Crear `/api/health`.  
* Crear `preparePayment`.  
* Levantar `apps/agent`.  
* Conectar Start → Agent.  
* Levantar PostgreSQL.  
* Persistir una operación mock.

## **Fase 3 — Voz**

* Crear `/api/asr/token`.  
* Capturar micrófono.  
* Conectar AssemblyAI.  
* Detectar `end_of_turn`.  
* Confirmar monto y token.  
* Integrar TTS.

## **Fase 4 — ADK y políticas**

* Integrar Google ADK.  
* Crear `PaymentIntent`.  
* Resolver proveedor.  
* Implementar límites.  
* Implementar idempotencia.  
* Persistir estados.

## **Fase 5 — AP2-inspired**

* Crear mandatos.  
* Canonicalizar JSON.  
* Calcular `mandateHash`.  
* Vincularlo con `paymentId` y `txHash`.  
* Anclarlo opcionalmente on-chain.

## **Fase 6 — x402**

* Crear wallet autónoma.  
* Fijar `maxValue`.  
* Fijar presupuesto diario.  
* Consultar `/supported`.  
* Firmar EIP-3009.  
* Liquidar.  
* Registrar receipt e idempotencia.

## **Fase 7 — Mainnet**

* Configurar Celo Mainnet.  
* Verificar direcciones.  
* Ejecutar una transferencia real mínima.  
* Verificar Attribution Tag.  
* Registrar explorer, mandato y demo.

---

# **Reparto del equipo**

## **IA/backend**

* `apps/agent`  
* Google ADK y Gemini  
* Políticas  
* AP2-inspired  
* PostgreSQL  
* Wallet x402  
* Receipt verifier  
* Google TTS  
* Estado e idempotencia

## **Frontend/blockchain**

* `apps/frontend`  
* TanStack Start/Router/Query  
* wagmi y viem  
* Wallet y cambio de red  
* ERC-20  
* EIP-712/EIP-3009  
* Attribution Tags  
* Blockscout  
* UX de confirmación

## **Onchain**

* `apps/onchain`  
* Hardhat 3  
* Configuración Celo  
* Scripts  
* Tests  
* Ignition  
* Registry opcional

## **Compartido**

* `packages/domain`  
* `packages/celo`  
* Contrato Start ↔ Agent  
* Pruebas end-to-end  
* README  
* Demo  
* Mainnet

La frontera principal es:

ADK interpreta.  
El motor de políticas decide.  
El mandato documenta.  
La wallet autoriza.  
Celo liquida.  
El backend verifica.

# **Recomendación final**

La arquitectura conserva el ADN de `idefy`:

Bun \+ Turborepo \+ Biome  
├── apps/frontend: TanStack Start \+ React \+ Vite  
├── apps/agent: Node \+ Fastify \+ Google ADK  
├── apps/onchain: Hardhat 3 \+ Solidity \+ Viem  
├── packages/domain  
└── packages/celo

La diferencia clave es que **TanStack Start sí posee backend integrado**. Se utiliza como BFF y frontera segura del navegador; Fastify queda reservado para el servicio ADK.

La combinación competitiva es:

**Un agente de pagos por voz que interpreta una orden con AssemblyAI, aplica políticas con Google ADK y Gemini, genera un mandato AP2-inspired, compra una validación mediante x402/EIP-3009 y ejecuta el pago principal en USDC o USDm sobre Celo.**

Prioridad:

1. Reutilizar correctamente `idefy`.  
2. Transferencia ERC-20 en Celo Sepolia.  
3. TanStack Start ↔ Agent.  
4. Voz \+ ADK \+ políticas.  
5. Receipt \+ Attribution Tag.  
6. x402 con wallet autónoma limitada.  
7. AP2-inspired.  
8. Mainnet.  
9. ERC-8004/ZK como extras.

[https://github.com/fabzio/idefy](https://github.com/fabzio/idefy)  
