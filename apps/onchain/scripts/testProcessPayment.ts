import { processPayment } from "../src/processPayment.js";

await processPayment({
  paymentId: "0xee782f8c0653c65f39ba8ab687de4e57c6bfd02d91e3702efa6c0a69f2ca5977",
  payer: "0x4b019d79623413FFb4C0Dc29f247c1663D41Ee2d",
  payee: "0x9326b707d83A4A299f255fbC9262618d294c9457",
  amount: "5",
  token: "USDC",
});