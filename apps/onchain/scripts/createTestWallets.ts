    import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const userPrivateKey = generatePrivateKey();
const merchantPrivateKey = generatePrivateKey();

const user = privateKeyToAccount(userPrivateKey);
const merchant = privateKeyToAccount(merchantPrivateKey);

console.log("USER WALLET");
console.log(user.address);
console.log("PRIVATE KEY");
console.log(userPrivateKey);

console.log("----------------");

console.log("MERCHANT WALLET");
console.log(merchant.address);
console.log("PRIVATE KEY");
console.log(merchantPrivateKey);