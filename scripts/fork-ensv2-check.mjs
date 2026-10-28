// Run against a mainnet fork: anvil --fork-url <mainnet rpc> --port 8547, then node scripts/fork-ensv2-check.mjs
// ENSv2 regression on a mainnet fork (anvil :8547): mint through both production paths, write
// records through the fixed widget-core, read back through the official Universal Resolver.
import { createPublicClient, createWalletClient, http, namehash, parseAbi, toHex, getAddress } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { mainnet } from "viem/chains";
import { packetToBytes } from "viem/ens";
import { registerVia, getMintFee, getResolver, setAddress, getAddressStatus, planPayeeRecords, groupByResolver,
  buildPayeeCalls, readPayeeRecords, publicResolverAbi, UNIVERSAL_RESOLVER, universalResolverAbi } from "../packages/widget-core/dist/index.js";
import { verifyPayee, viemReader } from "../packages/payee/dist/index.js";
const t = http("http://127.0.0.1:8547");
const pub = createPublicClient({ chain: mainnet, transport: t });
// A fresh EOA: anvil's well-known #0 carries an EIP-7702 delegation on mainnet, so it rejects ERC-1155 receipts.
// Impersonated by the node, as a browser wallet signs: the widget passes the account as a bare address.
const acct = { address: privateKeyToAccount(generatePrivateKey()).address };
const wallet = createWalletClient({ chain: mainnet, transport: t, account: acct.address });
const REGISTRAR = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633", FORWARDER = "0x05af104ce913e7ef39799bfada871817d3761778";
const NW = parseAbi(["function ownerOf(uint256) view returns (address)"]);
const ok = async (hash) => { const r = await pub.waitForTransactionReceipt({ hash }); if (r.status !== "success") throw new Error("REVERTED " + hash); return r; };
let fails = 0; const check = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) fails++; };
const id = Date.now().toString(36);
await pub.request({ method: "anvil_setBalance", params: [acct.address, "0x8AC7230489E80000"] });
await pub.request({ method: "anvil_impersonateAccount", params: [acct.address] });
check("test EOA has no code", (await pub.getCode({ address: acct.address })) === undefined);

// A) Widget path: registerVia on the forwarder, then point the name at the holder.
const a = `w${id}.402bot.eth`, aNode = namehash(a);
await ok(await registerVia({ registrar: REGISTRAR, forwarder: FORWARDER, publicClient: pub }, wallet,
  { parentNode: namehash("402bot.eth"), label: `w${id}`, platformTreasury: acct.address, platformFee: 0n, user: acct.address }));
check(`${a} minted to holder`, getAddress(await pub.readContract({ address: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401", abi: NW, functionName: "ownerOf", args: [BigInt(aNode)] })) === acct.address);
const [, , off] = await pub.readContract({ address: UNIVERSAL_RESOLVER, abi: universalResolverAbi, functionName: "findResolver", args: [toHex(packetToBytes(a))] });
check("old 0.6.0 lookup would have thrown (UR offset != 0)", off !== 0n, `offset=${off}`);
const ra = await getResolver(pub, a);
check("getResolver -> PublicResolver", ra === "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63", ra);
await ok(await setAddress(wallet, { resolver: ra, nodes: [aNode], address: acct.address, account: acct.address }));
const st = await getAddressStatus(pub, a, acct.address);
check("getAddressStatus linked (ETH + Base)", st.linked, JSON.stringify(st));
check("UR resolves ETH addr", (await pub.getEnsAddress({ name: a })) === acct.address);
check("UR resolves Base addr", getAddress(await pub.getEnsAddress({ name: a, coinType: 0x80000000n | 8453n })) === acct.address);

// B) Site path: registrar.register, then the /verify wizard's payee write.
const b = `p${id}.402api.eth`, bNode = namehash(b);
const fee = await getMintFee({ registrar: REGISTRAR, forwarder: FORWARDER, publicClient: pub });
await ok(await wallet.writeContract({ address: REGISTRAR, abi: parseAbi(["function register(bytes32,string) payable"]), functionName: "register", args: [namehash("402api.eth"), `p${id}`], value: fee }));
const origin = "https://fork-test.example.com";
const plan = planPayeeRecords([origin], [{ network: "eip155:8453", payTo: acct.address }]);
const groups = await groupByResolver(pub, [b]);
check("groupByResolver -> one PublicResolver group", groups.size === 1 && [...groups.keys()][0] === "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63");
for (const [resolver, names] of groups)
  await ok(await wallet.writeContract({ address: resolver, abi: publicResolverAbi, functionName: "multicall", args: [names.flatMap((n) => buildPayeeCalls(namehash(n), plan))] }));
const rec = await readPayeeRecords(pub, b, ["eip155:8453"]);
check("readPayeeRecords shows written origin + Base addr", rec.origins === origin && getAddress(rec.addrs["eip155:8453"]) === acct.address, JSON.stringify(rec));
const v = await verifyPayee({ x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453", payTo: acct.address, asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "1000" }],
  extensions: { "payee-name": { info: { name: b } } } }, origin, viemReader(pub));
check("verifier: payee-bound through the official UR", v[0]?.reason === "payee-bound", JSON.stringify(v[0]));
check("verifier: extended_resolver false (real resolver)", v[0]?.extended_resolver === false);
const wrong = await verifyPayee({ x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453", payTo: acct.address, asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "1000" }],
  extensions: { "payee-name": { info: { name: b } } } }, "https://evil.example.com", viemReader(pub));
check("verifier control: unlisted origin -> origin-not-listed", wrong[0]?.reason === "origin-not-listed", wrong[0]?.reason);
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
