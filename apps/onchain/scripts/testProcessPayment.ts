import { processPayment } from "../src/processPayment.js";

await processPayment({
  payer: "0x4b019d79623413FFb4C0Dc29f247c1663D41Ee2d",
  payee: "0x9326b707d83A4A299f255fbC9262618d294c9457",
  amount: "5",
  token: "USDC",
});