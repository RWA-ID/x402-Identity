import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { namehash } from "viem/ens";
import { config } from "dotenv";

config({ path: ".env.local" });

const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";

const NAME_WRAPPER_ABI = [
  {
    name: "setFuses",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "ownerControlledFuses", type: "uint16" },
    ],
    outputs: [{ type: "uint32" }],
  },
];

const CANNOT_UNWRAP = 1; // fuse bit 0

const PARENTS = [
  { name: "402bot.eth",  node: namehash("402bot.eth") },
  { name: "402api.eth",  node: namehash("402api.eth") },
  { name: "402mcp.eth",  node: namehash("402mcp.eth") },
];

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env.local");

const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, chain: mainnet, transport: http(process.env.NEXT_PUBLIC_ALCHEMY_MAINNET) });
const publicClient = createPublicClient({ chain: mainnet, transport: http(process.env.NEXT_PUBLIC_ALCHEMY_MAINNET) });

console.log("Burning CANNOT_UNWRAP on parent names from:", account.address);
console.log("⚠️  THIS IS IRREVERSIBLE — these names can never be unwrapped after this.\n");

for (const parent of PARENTS) {
  console.log(`Burning CANNOT_UNWRAP on ${parent.name}...`);
  const tx = await walletClient.writeContract({
    address: NAME_WRAPPER,
    abi: NAME_WRAPPER_ABI,
    functionName: "setFuses",
    args: [parent.node, CANNOT_UNWRAP],
  });
  console.log("  Tx:", tx);
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`  ✅ Done — ${parent.name} is now locked (CANNOT_UNWRAP burned)\n`);
}

console.log("🎉 All 3 parent names locked. You can now call setChildFuses on existing minted names.");
