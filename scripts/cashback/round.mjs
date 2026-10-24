/**
 * cashback/round.mjs
 *
 * Builds one $X402ID cashback round: 25% of the mint fee each minter actually
 * paid, valued in X402ID at the round's average pool price, paid out from the
 * fee Safe on Base as a Safe Transaction Builder batch.
 *
 * Usage:
 *   node scripts/cashback/round.mjs                      # dry run, round ends now
 *   node scripts/cashback/round.mjs --write              # save the round files
 *   node scripts/cashback/round.mjs --end 2026-10-24T00:00:00Z
 *   node scripts/cashback/round.mjs --cap 250000000 --exclude 0xabc…,0xdef…
 *   node scripts/cashback/round.mjs --price 7.8e-11      # override (ETH per X402ID)
 *
 * How it works:
 *   1. Round window: round 1 starts at token launch; every later round starts
 *      one block after the previous round file in scripts/cashback/rounds/
 *   2. Reads SubnameMinted from BOTH mainnet registrars. The `fee` field is the
 *      fee that mint really paid (0.005 before 2026-09-28, 0.0015 after), so no
 *      fee history is reconstructed. A forwarder mint logs minter = forwarder;
 *      the buyer comes from RegisteredVia in the same tx. The forwarder's
 *      platformFee went to the platform, not us, so it earns nothing
 *   3. Drops team wallets: deployer, the Safe, its live owners, --exclude
 *   4. Price = mean of daily X402ID/WETH closes (GeckoTerminal) across the
 *      round, forward-filling days without trades. No price → abort, never guess
 *   5. Round 1 also pays the genesis drop: 25% of what the pre-launch outside
 *      minter paid
 *   6. If the total exceeds --cap, every payout scales down pro rata
 *   7. With --write, saves rounds/round-N.json (the record) and rounds/round-N.safe-tx.json
 *      (import in Safe → Transaction Builder). If the Safe holds too few tokens
 *      the batch starts with release(scheduleId) on the token
 *
 * Signs nothing. Reads ETHERSCAN_API_KEY and NEXT_PUBLIC_ALCHEMY_BASE from .env.local
 */

import { createPublicClient, http, parseAbi, decodeEventLog, formatEther,
         formatUnits, getAddress, encodeFunctionData } from "viem";
import { base } from "viem/chains";
import { config } from "dotenv";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: ".env.local", quiet: true });

const ROUNDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "rounds");

// ── Mainnet (mints) ─────────────────────────────────────────────────────────
const REGISTRARS = [
  "0x0a9b0d20e9193dc5479ab98154124f4e2f569444", // old
  "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633", // current
];
const FORWARDERS = ["0x05af104ce913e7ef39799bfada871817d3761778"];
const LAUNCH_BLOCK = 26063986; // first mainnet block after 2026-09-26 20:22 UTC
const LAUNCH_TIME  = "2026-09-26T20:22:00Z";

// ── Base (payout) ───────────────────────────────────────────────────────────
const TOKEN    = "0xb9490fc272642A7De0539FB3dC52A2769936FBa3";
const SAFE     = "0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C";
const POOL     = "0x49369bb5411ef56cdf8469bc532be5aae84cb2a24df83e38cbe411185eee1c5c"; // X402ID/WETH v4
const SCHEDULE_ID = 0n; // the Safe's vesting schedule

const CASHBACK_BPS = 2500n; // 25%
const DEFAULT_CAP  = 250_000_000n; // X402ID per round

const TEAM = [
  "0x5f11a48230f7CdaB91A2361576239091E4b1165b", // deployer
  "0xaec1ed0559afacc5e46f66ce77010a017a557754", // Bankr launch wallet
  SAFE,
];

// Pre-launch outside minter, paid once in round 1
const GENESIS = "0x866F5DA24591B2401F04C1F3Dd0cBc799Bb52fdf";

// Etherscan getLogs returns at most 1000 records per call
const ETHERSCAN_PAGE = 1000;

const EVENTS_ABI = parseAbi([
  "event SubnameMinted(bytes32 indexed parentNode, string label, bytes32 subnameNode, address indexed minter, uint256 fee)",
  "event RegisteredVia(address indexed platformTreasury, address indexed user, bytes32 indexed parentNode, string label, uint256 protocolFee, uint256 platformFee)",
]);

const TOKEN_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function release(uint256 scheduleId)",
  "function computeAvailableVestedAmount(address) view returns (uint256)",
]);

const SAFE_ABI = parseAbi(["function getOwners() view returns (address[])"]);

// ── Args ────────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const END_TIME = arg("end") ?? new Date().toISOString();
const CAP      = BigInt(arg("cap") ?? DEFAULT_CAP) * 10n ** 18n;
const EXTRA_EXCLUDE = (arg("exclude") ?? "").split(",").filter(Boolean);
const PRICE_OVERRIDE = arg("price");
const WRITE = process.argv.includes("--write");

// ── Etherscan (mainnet) ─────────────────────────────────────────────────────
// Free tier: 3 calls/sec
let lastCall = 0;
async function etherscan(params) {
  const wait = lastCall + 400 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const qs = new URLSearchParams({ chainid: "1", ...params, apikey: process.env.ETHERSCAN_API_KEY });
  const res = await fetch(`https://api.etherscan.io/v2/api?${qs}`);
  const json = await res.json();
  if (json.status === "0" && json.message !== "No records found") {
    throw new Error(`Etherscan: ${json.message} ${JSON.stringify(json.result)}`);
  }
  return json.result;
}

async function getLogs(address, fromBlock, toBlock) {
  const logs = [];
  for (let page = 1; ; page++) {
    const batch = await etherscan({ module: "logs", action: "getLogs", address,
      fromBlock: String(fromBlock), toBlock: String(toBlock),
      page: String(page), offset: String(ETHERSCAN_PAGE) });
    if (!Array.isArray(batch)) break;
    logs.push(...batch);
    if (batch.length < ETHERSCAN_PAGE) break;
  }
  return logs;
}

function decode(log) {
  try {
    return decodeEventLog({ abi: EVENTS_ABI, data: log.data, topics: log.topics });
  } catch {
    return null; // ownership/fee/admin events
  }
}

// ── Price ───────────────────────────────────────────────────────────────────
async function averagePrice(startIso, endIso) {
  const url = `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL}/ohlcv/day`
    + `?currency=token&token=${TOKEN}&limit=1000`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
  const candles = (await res.json()).data.attributes.ohlcv_list
    .map(([t, , , , close]) => ({ day: t, close }))
    .sort((a, b) => a.day - b.day);

  const DAY = 86400;
  const start = Math.floor(Date.parse(startIso) / 1000 / DAY) * DAY;
  const end   = Math.floor(Date.parse(endIso) / 1000 / DAY) * DAY;

  // Forward-fill: a day without trades keeps the previous close. Days before
  // the pool's first trade have no price and are left out.
  const closes = [];
  let last;
  let i = 0;
  for (let day = Math.min(start, candles[0].day); day <= end; day += DAY) {
    while (i < candles.length && candles[i].day <= day) last = candles[i++].close;
    if (day >= start && last !== undefined) closes.push(last);
  }
  if (closes.length === 0) throw new Error("No pool price inside the round");
  return { price: closes.reduce((s, c) => s + c, 0) / closes.length, days: closes.length };
}

// ETH-per-token float → token base units for `wei` worth of ETH
function weiToTokens(wei, price) {
  const SCALE = 10n ** 27n;
  const priceScaled = BigInt(Math.round(price * 1e27));
  const units = (wei * SCALE) / priceScaled;
  return units - (units % 10n ** 18n); // whole tokens only
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(ROUNDS_DIR, { recursive: true }); // empty until the first --write
  const previous = readdirSync(ROUNDS_DIR)
    .filter((f) => /^round-\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(ROUNDS_DIR, f), "utf8")))
    .sort((a, b) => a.round - b.round)
    .at(-1);

  const round     = previous ? previous.round + 1 : 1;
  const fromBlock = previous ? previous.toBlock + 1 : LAUNCH_BLOCK;
  const startTime = previous ? previous.endTime : LAUNCH_TIME;
  const toBlock   = Number(await etherscan({ module: "block", action: "getblocknobytime",
    timestamp: String(Math.floor(Date.parse(END_TIME) / 1000)), closest: "before" }));

  console.log(`\nRound ${round}: ${startTime} → ${END_TIME} (blocks ${fromBlock}–${toBlock})`);

  // Team wallets, Safe owners read live (they rotate)
  const baseClient = createPublicClient({ chain: base, transport: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE) });
  const owners = await baseClient.readContract({ address: SAFE, abi: SAFE_ABI, functionName: "getOwners" });
  const excluded = new Set([...TEAM, ...owners, ...EXTRA_EXCLUDE].map((a) => getAddress(a)));

  // Forwarder buyers, keyed by tx + parent + label
  const viaUser = new Map();
  for (const fwd of FORWARDERS) {
    for (const log of await getLogs(fwd, fromBlock, toBlock)) {
      const ev = decode(log);
      if (ev?.eventName !== "RegisteredVia") continue;
      viaUser.set(`${log.transactionHash}:${ev.args.parentNode}:${ev.args.label}`, ev.args.user);
    }
  }

  const forwarders = new Set(FORWARDERS.map((a) => getAddress(a)));
  const mints = [];
  for (const registrar of REGISTRARS) {
    for (const log of await getLogs(registrar, fromBlock, toBlock)) {
      const ev = decode(log);
      if (ev?.eventName !== "SubnameMinted") continue;
      let buyer = getAddress(ev.args.minter);
      if (forwarders.has(buyer)) {
        const user = viaUser.get(`${log.transactionHash}:${ev.args.parentNode}:${ev.args.label}`);
        if (!user) throw new Error(`Forwarder mint without RegisteredVia: ${log.transactionHash}`);
        buyer = getAddress(user);
      }
      mints.push({
        tx: log.transactionHash,
        registrar,
        label: ev.args.label,
        parentNode: ev.args.parentNode,
        buyer,
        feeWei: ev.args.fee,
        eligible: !excluded.has(buyer),
      });
    }
  }

  console.log(`  ${mints.length} mint(s), ${mints.filter((m) => m.eligible).length} eligible`);
  for (const m of mints) {
    console.log(`  ${m.eligible ? "✓" : "✗"} ${m.label.padEnd(16)} ${m.buyer}  ${formatEther(m.feeWei)} ETH`);
  }

  // ETH owed per wallet
  const owedWei = new Map();
  const add = (addr, wei) => owedWei.set(addr, (owedWei.get(addr) ?? 0n) + wei);
  for (const m of mints) if (m.eligible) add(m.buyer, (m.feeWei * CASHBACK_BPS) / 10000n);

  let genesis = null;
  if (round === 1) {
    const logs = [];
    for (const r of REGISTRARS) logs.push(...await getLogs(r, 0, LAUNCH_BLOCK - 1));
    const paid = logs.map(decode)
      .filter((ev) => ev?.eventName === "SubnameMinted" && getAddress(ev.args.minter) === getAddress(GENESIS))
      .reduce((s, ev) => s + ev.args.fee, 0n);
    genesis = { address: getAddress(GENESIS), preLaunchFeeWei: paid.toString() };
    add(getAddress(GENESIS), (paid * CASHBACK_BPS) / 10000n);
    console.log(`  genesis ${GENESIS} paid ${formatEther(paid)} ETH pre-launch`);
  }

  if (owedWei.size === 0) {
    console.log("\nNothing owed this round. No files written.");
    return;
  }

  // Price
  const { price, days } = PRICE_OVERRIDE
    ? { price: Number(PRICE_OVERRIDE), days: 0 }
    : await averagePrice(startTime, END_TIME);
  console.log(`\n  price ${price.toExponential(6)} ETH/X402ID`
    + (PRICE_OVERRIDE ? " (override)" : ` (mean of ${days} daily closes)`));

  let payouts = [...owedWei].map(([address, wei]) => ({ address, owedWei: wei, tokens: weiToTokens(wei, price) }));
  let total = payouts.reduce((s, p) => s + p.tokens, 0n);
  const scaled = total > CAP;
  if (scaled) {
    payouts = payouts.map((p) => ({ ...p, tokens: weiToTokens(p.owedWei, price) * CAP / total / 10n ** 18n * 10n ** 18n }));
    total = payouts.reduce((s, p) => s + p.tokens, 0n);
    console.log(`  over cap: scaled pro rata to ${formatUnits(total, 18)} X402ID`);
  }
  payouts = payouts.filter((p) => p.tokens > 0n);

  for (const p of payouts) {
    console.log(`  → ${p.address}  ${formatEther(p.owedWei)} ETH = ${formatUnits(p.tokens, 18)} X402ID`);
  }
  console.log(`  total ${formatUnits(total, 18)} X402ID`);

  // Funding: release vested tokens first if the Safe is short
  const [balance, releasable] = await Promise.all([
    baseClient.readContract({ address: TOKEN, abi: TOKEN_ABI, functionName: "balanceOf", args: [SAFE] }),
    baseClient.readContract({ address: TOKEN, abi: TOKEN_ABI, functionName: "computeAvailableVestedAmount", args: [SAFE] }),
  ]);
  const needsRelease = balance < total;
  console.log(`\n  Safe balance ${formatUnits(balance, 18)}, releasable ${formatUnits(releasable, 18)}`);
  if (needsRelease && balance + releasable < total) {
    console.log("  ⚠ Safe can't fund this round yet (vesting cliff 2026-10-26). Run with --write after the cliff.");
  }

  const txs = [];
  if (needsRelease) {
    txs.push({
      to: TOKEN, value: "0", data: null,
      contractMethod: { name: "release", payable: false,
        inputs: [{ name: "scheduleId", type: "uint256", internalType: "uint256" }] },
      contractInputsValues: { scheduleId: SCHEDULE_ID.toString() },
    });
  }
  for (const p of payouts) {
    txs.push({
      to: TOKEN, value: "0", data: null,
      contractMethod: { name: "transfer", payable: false,
        inputs: [
          { name: "to", type: "address", internalType: "address" },
          { name: "value", type: "uint256", internalType: "uint256" },
        ] },
      contractInputsValues: { to: p.address, value: p.tokens.toString() },
    });
  }

  // Raw calldata too, so a reviewer can check the batch without the Safe UI
  const calldata = [
    ...(needsRelease ? [encodeFunctionData({ abi: TOKEN_ABI, functionName: "release", args: [SCHEDULE_ID] })] : []),
    ...payouts.map((p) => encodeFunctionData({ abi: TOKEN_ABI, functionName: "transfer", args: [p.address, p.tokens] })),
  ];

  const record = {
    round,
    startTime, endTime: END_TIME,
    fromBlock, toBlock,
    cashbackBps: Number(CASHBACK_BPS),
    price: { ethPerToken: price, source: PRICE_OVERRIDE ? "override" : `geckoterminal ${POOL}`, days },
    cap: CAP.toString(), scaledToCap: scaled,
    excluded: [...excluded],
    genesis,
    mints: mints.map((m) => ({ ...m, feeWei: m.feeWei.toString() })),
    payouts: payouts.map((p) => ({ address: p.address, owedWei: p.owedWei.toString(), tokens: p.tokens.toString() })),
    totalTokens: total.toString(),
    safe: SAFE, token: TOKEN, calldata,
  };

  const safeBatch = {
    version: "1.0",
    chainId: "8453",
    createdAt: Date.now(),
    meta: {
      name: `X402ID cashback round ${round}`,
      description: `25% mint-fee cashback, ${startTime} → ${END_TIME}. ${payouts.length} recipient(s), ${formatUnits(total, 18)} X402ID.`,
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: SAFE,
    },
    transactions: txs,
  };

  if (!WRITE) {
    console.log("\n  Dry run. Re-run with --write to save the round and the Safe batch.\n");
    return;
  }
  const recordPath = join(ROUNDS_DIR, `round-${round}.json`);
  const batchPath  = join(ROUNDS_DIR, `round-${round}.safe-tx.json`);
  writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  writeFileSync(batchPath, JSON.stringify(safeBatch, null, 2) + "\n");
  console.log(`\n  wrote ${recordPath}\n  wrote ${batchPath}`);
  console.log("  Import the .safe-tx.json in Safe → Transaction Builder on Base; 2 of 3 signers.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
