import Fastify from "fastify";
import { processPayment } from "./processPayment.js";

const app = Fastify({
    logger: true,
});


app.get("/health", async () => {
    return {
        ok: true,
        service: "onchain",
    };
});


app.post("/payments/execute", async (request) => {

    const body = request.body as any;


    const tx = await processPayment({
        paymentId: body.paymentId,
        payer: body.payer,
        payee: body.payee,
        amount: body.amount,
        token: "USDC",
    });


    return {
        tx,
    };
});


app.listen({
    port: 3002,
    host: "127.0.0.1",
});