import { createPublicClient, http, fallback } from "viem";
import { mainnet } from "viem/chains";
import { verifyPayee, viemReader } from "../dist/index.js";
const client = createPublicClient({ chain: mainnet, transport: fallback([
  http("https://gateway.tenderly.co/public/mainnet"), http("https://eth.api.onfinality.io/public")]) });
const r = viemReader(client);
const PAY = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const cases = [
  ["vitalik.eth", "eip155:1", "https://vitalik.ca"],
  ["hofmann.402mcp.eth", "eip155:8453", "https://x.example"],
  ["mpp.402bot.eth", "eip155:8453", "https://x.example"],
  ["zzz-not-registered-9431.402bot.eth", "eip155:8453", "https://x.example"],
];
for (const [name, network, origin] of cases) {
  const v = await verifyPayee({ accepts: [{ network, payTo: PAY }], extensions: { "payee-name": { info: { name } } } }, origin, r);
  const { verdict, reason, expires_at, parent_can_control, extended_resolver, detail } = v[0];
  console.log(name.padEnd(36), JSON.stringify({ verdict, reason, expires_at, parent_can_control, extended_resolver, detail }));
}
// Failure path: a dead RPC must be inconclusive, not a denial.
const dead = viemReader(createPublicClient({ chain: mainnet, transport: http("https://127.0.0.1:9/") , }));
const v = await verifyPayee({ accepts: [{ network: "eip155:1", payTo: PAY }], extensions: { "payee-name": { info: { name: "vitalik.eth" } } } }, "https://vitalik.ca", dead);
console.log("dead RPC".padEnd(36), v[0].verdict, v[0].reason);
