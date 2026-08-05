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
 *   1. Fetches all SubnameMinted events from both registrars (old + new)
 *   2. Calls nameWrapper.extendExpiry(parentNode, labelhash, type(uint64).max)
 *      for each one — capped automatically at the current parent expiry
 *   3. PARENT_CANNOT_CONTROL does NOT block extendExpiry, so this works even
 *      though minters have true ownership of their names
 */

import { createWalletClient, createPublicClient, http, keccak256, toBytes,
         decodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { config } from "dotenv";

config({ path: ".env.local" });

const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";

// Both registrars — old one (fuses=0) and new one (fuses=65536)
const REGISTRARS = [
  { address: "0x0a9b0d20e9193dc5479ab98154124f4e2f569444", fromBlock: 0 },          // old
  { address: "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633", fromBlock: 24779603 },   // new
];

// SubnameMinted(bytes32 indexed parentNode, string label, bytes32 subnameNode,
//               address indexed minter, uint256 fee)
// topic0 = keccak256 of signature above
const TOPIC0 = "0x8fd05628e8c8091170a3b692a1bcb11cf2b13b6020e3ff27b62753bfaa419b0d";

// Non-indexed fields in data: label (string), subnameNode (bytes32), fee (uint256)
// minter is indexed → in topics[2], NOT in data
const DATA_PARAMS = parseAbiParameters("string label, bytes32 subnameNode, uint256 fee");

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

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env.local");

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY;
if (!ETHERSCAN_KEY) throw new Error("ETHERSCAN_API_KEY not set in .env.local");

const account      = privateKeyToAccount(PRIVATE_KEY);
const transport    = http(process.env.NEXT_PUBLIC_ALCHEMY_MAINNET);
const publicClient = createPublicClient({ chain: mainnet, transport });
const walletClient = createWalletClient({ account, chain: mainnet, transport });

console.log("Wallet:", account.address);
console.log("Fetching SubnameMinted events from both registrars via Etherscan...\n");

// ── 1. Fetch events from all registrars ──────────────────────────────────────
const allNames = new Map(); // subnameNode → { parentNode, label }

for (const { address, fromBlock } of REGISTRARS) {
  const url = `https://api.etherscan.io/v2/api?chainid=1&module=logs&action=getLogs` +
    `&address=${address}&topic0=${TOPIC0}` +
    `&fromBlock=${fromBlock}&toBlock=latest&apikey=${ETHERSCAN_KEY}`;

  const res  = await fetch(url);
  const json = await res.json();

  if (json.status !== "1" || !Array.isArray(json.result)) {
    console.log(`  No events from ${address} (${json.message})`);
    continue;
  }

  for (const log of json.result) {
    const parentNode = log.topics[1]; // indexed bytes32
    try {
      const [label, subnameNode] = decodeAbiParameters(DATA_PARAMS, log.data);
      if (!allNames.has(subnameNode)) {
        allNames.set(subnameNode, { parentNode, label });
      }
    } catch (e) {
      console.log(`  ⚠️  Failed to decode log from ${address}: ${e.message}`);
    }
  }

  console.log(`  ${address}: ${json.result.length} event(s)`);
}

console.log(`\nTotal unique subnames: ${allNames.size}\n`);

if (allNames.size === 0) {
  console.log("Nothing to extend.");
  process.exit(0);
}

// ── 2. Extend each subname's expiry to match parent ──────────────────────────
const MAX_EXPIRY = 18446744073709551615n; // type(uint64).max — capped at parent expiry

let succeeded = 0;
let skipped   = 0;
let failed    = 0;

for (const [subnameNode, { parentNode, label }] of allNames) {
  const labelhash = keccak256(toBytes(label));
  const tokenId   = BigInt(subnameNode);

  // Read current subname expiry
  let currentExpiry;
  try {
    const d = await publicClient.readContract({
      address: NAME_WRAPPER, abi: NAME_WRAPPER_ABI,
      functionName: "getData", args: [tokenId],
    });
    currentExpiry = d[2];
  } catch {
    console.log(`  ⚠️  ${label} — could not read data, skipping`);
    skipped++;
    continue;
  }

  // Read parent expiry
  let parentExpiry = 0n;
  try {
    const pd = await publicClient.readContract({
      address: NAME_WRAPPER, abi: NAME_WRAPPER_ABI,
      functionName: "getData", args: [BigInt(parentNode)],
    });
    parentExpiry = pd[2];
  } catch { /* ignore */ }

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
      address: NAME_WRAPPER, abi: NAME_WRAPPER_ABI,
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
