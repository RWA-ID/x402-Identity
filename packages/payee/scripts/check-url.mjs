// Fetch a paid URL unpaid, decode its 402 and verify payee-name against the
// origin actually contacted: node scripts/check-url.mjs <url>
import { createPublicClient, http, fallback } from "viem";
import { mainnet } from "viem/chains";
import { verifyPayee, viemReader } from "../dist/index.js";
const url = process.argv[2];
const res = await fetch(url);
const header = res.headers.get("payment-required");
if (res.status !== 402 || !header) throw new Error(`expected a 402 with PAYMENT-REQUIRED, got ${res.status}`);
const pr = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
console.log("declared:", JSON.stringify(pr.extensions?.["payee-name"]), "| payTo:", pr.accepts.map((a) => `${a.network}:${a.payTo}`).join(" "));
const reader = viemReader(createPublicClient({ chain: mainnet, transport: fallback([
  http("https://gateway.tenderly.co/public/mainnet"), http("https://eth.api.onfinality.io/public")]) }));
// Origin from the URL we fetched (fetch followed no cross-origin redirect: res.url checked below).
if (new URL(res.url).origin !== new URL(url).origin) throw new Error(`redirected to ${res.url}`);
console.log(JSON.stringify(await verifyPayee(pr, new URL(res.url).origin, reader), null, 2));
