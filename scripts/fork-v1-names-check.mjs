// Run against a mainnet fork: anvil --fork-url <mainnet rpc> --port 8547, then node scripts/fork-v1-names-check.mjs
// The /verify wizard's payee write on real v1 names (wrapped and unwrapped), as their holder,
// then the verifier reading them back through the official Universal Resolver.
import { createPublicClient, createWalletClient, http, namehash, getAddress, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { planPayeeRecords, groupByResolver, buildPayeeCalls, readPayeeRecords, publicResolverAbi } from "../packages/widget-core/dist/index.js";
import { verifyPayee, viemReader } from "../packages/payee/dist/index.js";
const t = http("http://127.0.0.1:8547");
const pub = createPublicClient({ chain: mainnet, transport: t });
const HOLDER = process.env.HOLDER || "0x0104c88Ea4f55c26df89F5cd3eC62F3C8288D69b"; // vault.ensgiant.eth
const NAMES = (process.env.NAMES || "vault.ensgiant.eth,billiard.eth,breilyn.eth").split(",");
await pub.request({ method: "anvil_impersonateAccount", params: [HOLDER] });
await pub.request({ method: "anvil_setBalance", params: [HOLDER, "0x8AC7230489E80000"] });
const wallet = createWalletClient({ chain: mainnet, transport: t, account: HOLDER });
const owner = parseAbi(["function owner(bytes32) view returns (address)"]);
let fails = 0; const check = (l, c, x = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  " + x : ""}`); if (!c) fails++; };
const origin = "https://fork-v1.example.com";
const plan = planPayeeRecords([origin], [{ network: "eip155:8453", payTo: HOLDER }]);
for (const name of NAMES) {
  const reg = await pub.readContract({ address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e", abi: owner, functionName: "owner", args: [namehash(name)] });
  const kind = getAddress(reg) === "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401" ? "wrapped" : "unwrapped";
  const groups = await groupByResolver(pub, [name]);
  for (const [resolver, names] of groups) {
    const hash = await wallet.writeContract({ address: resolver, abi: publicResolverAbi, functionName: "multicall", args: [names.flatMap((n) => buildPayeeCalls(namehash(n), plan))] });
    const r = await pub.waitForTransactionReceipt({ hash });
    check(`${name} (${kind}, resolver ${resolver.slice(0, 8)}) payee write`, r.status === "success");
  }
  const rec = await readPayeeRecords(pub, name, ["eip155:8453"]);
  check(`${name} records read back`, rec.origins === origin && getAddress(rec.addrs["eip155:8453"]) === getAddress(HOLDER), JSON.stringify(rec));
  const pr = { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453", payTo: HOLDER, asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "1000" }], extensions: { "payee-name": { info: { name } } } };
  const v = await verifyPayee(pr, origin, viemReader(pub));
  check(`${name} verifier`, v[0]?.reason === "payee-bound", `${v[0]?.reason} parent_can_control=${v[0]?.parent_can_control} expires=${v[0]?.expires_at}`);
}
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
