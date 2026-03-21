import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { namehash } from "viem/ens";
import { config } from "dotenv";

config({ path: ".env.local" });

const REGISTRAR    = "0x9d95cb7966b36ffe0a05de1c922e5991ac553082";
const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";

const NAME_WRAPPER_ABI = [
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
];

const REGISTRAR_ABI = [
  {
    name: "addParent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "label", type: "string" },
    ],
    outputs: [],
  },
];

const PARENTS = [
  { name: "402bot.eth",  node: namehash("402bot.eth") },
  { name: "402api.eth",  node: namehash("402api.eth") },
  { name: "402mcp.eth",  node: namehash("402mcp.eth") },
];

const ALCHEMY_MAINNET = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET;
const PRIVATE_KEY     = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env.local");

const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, chain: mainnet, transport: http(ALCHEMY_MAINNET) });
const publicClient = createPublicClient({ chain: mainnet, transport: http(ALCHEMY_MAINNET) });

async function main() {
  console.log("Setting up with:", account.address);
  console.log("Registrar:", REGISTRAR);

  // Step 1: Approve registrar as operator on NameWrapper
  console.log("\n1. Approving registrar as NameWrapper operator...");
  const approveTx = await walletClient.writeContract({
    address: NAME_WRAPPER,
    abi: NAME_WRAPPER_ABI,
    functionName: "setApprovalForAll",
    args: [REGISTRAR, true],
  });
  console.log("   Tx:", approveTx);
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log("   ✅ Approved");

  // Step 2: Add each parent node
  for (const parent of PARENTS) {
    console.log(`\n2. Adding parent: ${parent.name}...`);
    const tx = await walletClient.writeContract({
      address: REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: "addParent",
      args: [parent.node, parent.name],
    });
    console.log("   Tx:", tx);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`   ✅ Added ${parent.name}`);
  }

  console.log("\n🎉 Setup complete! The registrar is ready to mint subnames.");
}

main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
