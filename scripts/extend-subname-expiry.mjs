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
 *   1. Fetches every NewOwner event on the ENS registry under each parent.
 *      This finds every subname however it was created — registrar mints,
 *      forwarder mints, and names issued by hand via NameWrapper (which emit
 *      no SubnameMinted event and were missed by the old registrar-log scan)
 *   2. Calls nameWrapper.extendExpiry(parentNode, labelhash, type(uint64).max)
 *      for each one — capped automatically at the current parent expiry
 *   3. PARENT_CANNOT_CONTROL does NOT block extendExpiry, so this works even
 *      though minters have true ownership of their names
 */

import { createWalletClient, createPublicClient, http, keccak256, toBytes,
         hexToBytes, namehash, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { config } from "dotenv";

config({ path: ".env.local" });

const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const PARENTS = ["402bot.eth", "402api.eth", "402mcp.eth"];

// NewOwner(bytes32 indexed node, bytes32 indexed label, address owner)
const NEW_OWNER_TOPIC = keccak256(toBytes("NewOwner(bytes32,bytes32,address)"));

// Etherscan getLogs returns at most 1000 records per call
const ETHERSCAN_PAGE = 1000;

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
  {
    name: "names",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "bytes" }],
  },
];

// DNS wire format (03 6d7070 06 343032626f74 03 657468 00) → "mpp.402bot.eth"
function decodeDnsName(hex) {
  const b = hexToBytes(hex);
  const parts = [];
  for (let i = 0; i < b.length && b[i] !== 0; i += b[i] + 1) {
    parts.push(new TextDecoder().decode(b.slice(i + 1, i + 1 + b[i])));
  }
  return parts.join(".");
}

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env.local");

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY;
if (!ETHERSCAN_KEY) throw new Error("ETHERSCAN_API_KEY not set in .env.local");

const account      = privateKeyToAccount(PRIVATE_KEY);
const transport    = http(process.env.NEXT_PUBLIC_ALCHEMY_MAINNET);
const publicClient = createPublicClient({ chain: mainnet, transport });
const walletClient = createWalletClient({ account, chain: mainnet, transport });

console.log("Wallet:", account.address);
console.log("Fetching every subname under each parent from the ENS registry via Etherscan...\n");

// ── 1. Fetch NewOwner events for each parent ─────────────────────────────────
const allNames = new Map(); // subnameNode → { parentNode, labelhash }

for (const parent of PARENTS) {
  const parentNode = namehash(parent);
  let count = 0;

  for (let page = 1; ; page++) {
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=logs&action=getLogs` +
      `&address=${ENS_REGISTRY}&topic0=${NEW_OWNER_TOPIC}&topic1=${parentNode}&topic0_1_opr=and` +
      `&fromBlock=0&toBlock=latest&page=${page}&offset=${ETHERSCAN_PAGE}&apikey=${ETHERSCAN_KEY}`;

    const json = await (await fetch(url)).json();

    // "No records found" is a real empty result; anything else is an error and
    // must stop the run — a failed fetch must never read as "no subnames"
    if (!Array.isArray(json.result)) {
      if (json.message === "No records found") break;
      throw new Error(`Etherscan getLogs failed for ${parent}: ${json.message} ${json.result}`);
    }

    for (const log of json.result) {
      const labelhash   = log.topics[2];
      const subnameNode = keccak256(encodePacked(["bytes32", "bytes32"], [parentNode, labelhash]));
      if (!allNames.has(subnameNode)) {
        allNames.set(subnameNode, { parentNode, labelhash });
        count++;
      }
    }

    if (json.result.length < ETHERSCAN_PAGE) break;
  }

  console.log(`  ${parent}: ${count} subname(s)`);
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

// Parent expiries — read once; a failed read must stop the run, not read as 0
const parentExpiries = new Map();
for (const parent of PARENTS) {
  const pd = await publicClient.readContract({
    address: NAME_WRAPPER, abi: NAME_WRAPPER_ABI,
    functionName: "getData", args: [BigInt(namehash(parent))],
  });
  parentExpiries.set(namehash(parent), pd[2]);
}

for (const [subnameNode, { parentNode, labelhash }] of allNames) {
  const tokenId = BigInt(subnameNode);

  // Read current subname expiry + its name for display
  let currentExpiry, label;
  try {
    const d = await publicClient.readContract({
      address: NAME_WRAPPER, abi: NAME_WRAPPER_ABI,
      functionName: "getData", args: [tokenId],
    });
    currentExpiry = d[2];
    const dns = await publicClient.readContract({
      address: NAME_WRAPPER, abi: NAME_WRAPPER_ABI,
      functionName: "names", args: [subnameNode],
    });
    label = dns === "0x" ? subnameNode : decodeDnsName(dns);
  } catch {
    console.log(`  ⚠️  ${subnameNode} — could not read data, skipping`);
    skipped++;
    continue;
  }

  // Expiry 0 = never issued with an expiry (or unwrapped) — nothing live to keep alive
  if (currentExpiry === 0n) {
    console.log(`  –  ${label} — no expiry set (not an active wrapped name), skipping`);
    skipped++;
    continue;
  }

  const parentExpiry = parentExpiries.get(parentNode);
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
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    // waitForTransactionReceipt does not throw on a revert — check status explicitly
    if (receipt.status !== "success") throw new Error(`reverted (tx: ${tx})`);
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
