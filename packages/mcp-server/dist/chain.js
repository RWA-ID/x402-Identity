import { createPublicClient, createWalletClient, fallback, http, getAddress, namehash, parseEther, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
// ── Mainnet deployments ─────────────────────────────────────────────────────
export const REGISTRAR = getAddress("0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633");
export const FORWARDER = getAddress("0x05af104ce913e7ef39799bfada871817d3761778");
export const NAME_WRAPPER = getAddress("0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401");
// Registrar deployed May 2026 — floor keeps full-range log scans bounded.
export const REGISTRAR_FLOOR_BLOCK = 24500000n;
export const MAX_BATCH = 10;
// ── Supported parents ───────────────────────────────────────────────────────
export const PARENTS = ["402bot.eth", "402api.eth", "402mcp.eth"];
export function parentNodeOf(parent) {
    return namehash(parent);
}
export const NODE_TO_PARENT = new Map(PARENTS.map((p) => [namehash(p), p]));
// ── ABI fragments not covered by widget-core ────────────────────────────────
export const registerAbi = [
    {
        name: "register",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "parentNode", type: "bytes32" },
            { name: "label", type: "string" },
        ],
        outputs: [],
    },
    {
        name: "batchRegister",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "parentNodes", type: "bytes32[]" },
            { name: "labels", type: "string[]" },
        ],
        outputs: [],
    },
];
export const subnameMintedEvent = {
    name: "SubnameMinted",
    type: "event",
    inputs: [
        { name: "parentNode", type: "bytes32", indexed: true },
        { name: "label", type: "string", indexed: false },
        { name: "subnameNode", type: "bytes32", indexed: false },
        { name: "minter", type: "address", indexed: true },
        { name: "fee", type: "uint256", indexed: false },
    ],
};
/** Forwarder event — carries the real user for mints routed via registerVia. */
export const registeredViaEvent = {
    name: "RegisteredVia",
    type: "event",
    inputs: [
        { name: "platformTreasury", type: "address", indexed: true },
        { name: "user", type: "address", indexed: true },
        { name: "parentNode", type: "bytes32", indexed: true },
        { name: "label", type: "string", indexed: false },
        { name: "protocolFee", type: "uint256", indexed: false },
        { name: "platformFee", type: "uint256", indexed: false },
    ],
};
export const nameWrapperAbi = [
    {
        name: "ownerOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "id", type: "uint256" }],
        outputs: [{ type: "address" }],
    },
];
export function buildContext(env = process.env) {
    const rpcUrl = env.X402_RPC_URL || env.RPC_URL;
    // Keyless endpoints that accept full-range eth_getLogs (needed by list_names).
    const transports = [
        ...(rpcUrl ? [http(rpcUrl)] : []),
        http("https://gateway.tenderly.co/public/mainnet"),
        http("https://eth.api.onfinality.io/public"),
    ];
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: fallback(transports),
    });
    let wallet = null;
    const pk = env.X402_PRIVATE_KEY || env.PRIVATE_KEY;
    if (pk) {
        const account = privateKeyToAccount(pk);
        wallet = createWalletClient({
            account,
            chain: mainnet,
            transport: fallback(transports),
        });
    }
    let platform = null;
    if (env.X402_PLATFORM_TREASURY) {
        platform = {
            treasury: getAddress(env.X402_PLATFORM_TREASURY),
            feeWei: BigInt(env.X402_PLATFORM_FEE_WEI ?? "0"),
        };
    }
    return {
        publicClient,
        wallet,
        maxSpendWei: env.X402_MAX_SPEND_WEI
            ? BigInt(env.X402_MAX_SPEND_WEI)
            : parseEther("0.1"),
        platform,
    };
}
//# sourceMappingURL=chain.js.map