/**
 * extend-subname-expiry.mjs
 *
 * After extending a parent name's expiry (402bot.eth, 402api.eth, 402mcp.eth),
 * run this script to sync all minted subnames to the new parent expiry.
 *
 * Usage:
 *   node scripts/extend-subname-expiry.mjs
 *
 * How it works:
 *   1. Fetches all SubnameMinted events from the registrar
 *   2. Calls nameWrapper.extendExpiry(parentNode, labelhash, type(uint64).max)
 *      for each one — capped automatically at the current parent expiry
 *   3. PARENT_CANNOT_CONTROL does NOT block extendExpiry, so this works even
 *      though minters have true ownership of their names
 */

import { createWalletClient, createPublicClient, http, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { config } from "dotenv";

config({ path: ".env.local" });

const NAME_WRAPPER    = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const REGISTRAR       = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";
const DEPLOY_BLOCK    = 24779603n; // block when registrar was deployed

const NAME_WRAPPER_ABI = [
  {
    name: "extendExpiry",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "labelhash",  type: "bytes32" },
      { name: "expiry",     type: "uint64"  },
    ],
    outputs: [{ type: "uint64" }],
  },
  {
    name: "getData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "owner",  type: "address" },
      { name: "fuses",  type: "uint32"  },
      { name: "expiry", type: "uint64"  },
    ],
  },
];

const REGISTRAR_ABI = [
  {
    name: "SubnameMinted",
    type: "event",
    inputs: [
      { name: "parentNode",   type: "bytes32", indexed: true  },
      { name: "label",        type: "string",  indexed: false },
      { name: "subnameNode",  type: "bytes32", indexed: false },
      { name: "minter",       type: "address", indexed: true  },
      { name: "fee",          type: "uint256", indexed: false },
    ],
  },
];

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env.local");

const account      = privateKeyToAccount(PRIVATE_KEY);
const transport    = http(process.env.NEXT_PUBLIC_ALCHEMY_MAINNET);
const publicClient = createPublicClient({ chain: mainnet, transport });
const walletClient = createWalletClient({ account, chain: mainnet, transport });

console.log("Wallet:", account.address);
console.log("Fetching all SubnameMinted events from block", DEPLOY_BLOCK.toString(), "...\n");

// ── 1. Fetch all mint events ──────────────────────────────────────────────────
const logs = await publicClient.getLogs({
  address: REGISTRAR,
  event: REGISTRAR_ABI[0],
  fromBlock: DEPLOY_BLOCK,
  toBlock: "latest",
});

console.log(`Found ${logs.length} minted subnames.\n`);

if (logs.length === 0) {
  console.log("Nothing to extend.");
  process.exit(0);
}

// Deduplicate by subnameNode (in case of re-indexing edge cases)
const seen = new Set();
const names = [];
for (const log of logs) {
  const { parentNode, label, subnameNode } = log.args;
  if (!seen.has(subnameNode)) {
    seen.add(subnameNode);
    names.push({ parentNode, label, subnameNode });
  }
}

// ── 2. Extend each subname's expiry ──────────────────────────────────────────
const MAX_EXPIRY = 18446744073709551615n; // type(uint64).max — capped at parent expiry by NameWrapper

let succeeded = 0;
let skipped   = 0;
let failed    = 0;

for (const { parentNode, label, subnameNode } of names) {
  const labelhash = keccak256(toBytes(label));
  const tokenId   = BigInt(subnameNode);

  // Check current expiry
  let currentExpiry;
  try {
    const data = await publicClient.readContract({
      address: NAME_WRAPPER,
      abi: NAME_WRAPPER_ABI,
      functionName: "getData",
      args: [tokenId],
    });
    currentExpiry = data[2]; // expiry field
  } catch {
    console.log(`  ⚠️  ${label} — could not read data, skipping`);
    skipped++;
    continue;
  }

  // Read parent expiry to compare
  let parentExpiry;
  try {
    const parentData = await publicClient.readContract({
      address: NAME_WRAPPER,
      abi: NAME_WRAPPER_ABI,
      functionName: "getData",
      args: [BigInt(parentNode)],
    });
    parentExpiry = parentData[2];
  } catch {
    parentExpiry = 0n;
  }

  const currentDate = new Date(Number(currentExpiry) * 1000).toISOString().split("T")[0];
  const parentDate  = new Date(Number(parentExpiry)  * 1000).toISOString().split("T")[0];

  if (currentExpiry >= parentExpiry) {
    console.log(`  ✓ ${label} — already at max (${currentDate}), skipping`);
    skipped++;
    continue;
  }

  console.log(`  ↗  ${label} — ${currentDate} → ${parentDate}`);

  try {
    const tx = await walletClient.writeContract({
      address: NAME_WRAPPER,
      abi: NAME_WRAPPER_ABI,
      functionName: "extendExpiry",
      args: [parentNode, labelhash, MAX_EXPIRY],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`     ✅ Done  (tx: ${tx})`);
    succeeded++;
  } catch (err) {
    console.log(`     ❌ Failed: ${err.shortMessage || err.message}`);
    failed++;
  }
}

console.log(`\n── Summary ──────────────────────────────`);
console.log(`  Extended : ${succeeded}`);
console.log(`  Skipped  : ${skipped}`);
console.log(`  Failed   : ${failed}`);
console.log(`─────────────────────────────────────────`);
