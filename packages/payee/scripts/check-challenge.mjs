// Verify a payee-name declaration: node scripts/check-challenge.mjs <name> <origin> <network> <payTo>
import { createPublicClient, http, fallback } from "viem";
import { mainnet } from "viem/chains";
import { verifyPayee, viemReader } from "../dist/index.js";
const [name, origin, network, payTo] = process.argv.slice(2);
const reader = viemReader(createPublicClient({ chain: mainnet, transport: fallback([
  http("https://gateway.tenderly.co/public/mainnet"), http("https://eth.api.onfinality.io/public")]) }));
const pr = { accepts: [{ network, payTo }], extensions: { "payee-name": { info: { name } } } };
console.log(JSON.stringify(await verifyPayee(pr, origin, reader), null, 2));
