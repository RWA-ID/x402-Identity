// What widget-core plans is what the verifier accepts: the writer and the
// checker must agree on the record format.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planPayeeRecords } from "@x402identity/widget-core";
import { verifyPayee, PARENT_CANNOT_CONTROL, NAME_WRAPPER } from "../dist/index.js";

const NOW = 1_800_000_000n;
const ORIGIN = "https://agent.example.workers.dev";
const accepts = [
  { network: "eip155:8453", payTo: "0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C" },
  { network: "eip155:8453", payTo: "0x1111111111111111111111111111111111111111" },
  { network: "eip155:1", payTo: "0x2222222222222222222222222222222222222222" },
  { network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", payTo: "5Wxg3V6gcmFmmP6SXmGZQAUZPFYsSwoeN2Qewt5BotWz" },
  { network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", payTo: "112QftUJC9yYkE7xr4ikuFmaHKhLCxkpK5RL1J2QqC2" },
  { network: "lnbtc:000000000019d6689c085ae165831e93", payTo: "03c913d061dfe0adbfd87c0e98e66033be0dbbb2413de26bd363c63970480a9a80" },
  { network: "eip155:4663", payTo: "0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C" },
];

test("records planned by widget-core verify as payee-bound for every accept", async () => {
  const plan = planPayeeRecords([`${ORIGIN}/v1/route`], accepts);
  const texts = { "org.x402.origins": plan.origins.join(" "), "org.x402.payto": plan.payto.join(" ") };
  const addrs = Object.fromEntries(plan.addrs.map((a) => [a.coinType.toString(), a.value]));
  const reader = {
    now: async () => NOW,
    text: async (_n, k) => texts[k] || null,
    addr: async (_n, ct) => addrs[ct.toString()] ?? null,
    registryOwner: async () => NAME_WRAPPER,
    wrapperData: async () => ({ owner: "0x3333333333333333333333333333333333333333", fuses: PARENT_CANNOT_CONTROL, expiry: NOW + 10n ** 9n }),
    nameExpires: async () => NOW + 10n ** 9n,
    extendedResolver: async () => false,
  };
  const verdicts = await verifyPayee({ accepts, extensions: { "payee-name": { info: { name: "agent.402bot.eth" } } } }, ORIGIN, reader);
  assert.deepEqual(verdicts.map((v) => [v.verdict, v.matched_by]), [
    [true, "addr"], // Base primary
    [true, "org.x402.payto"], // Base, second payTo
    [true, "addr"], // Ethereum
    [true, "addr"], // Solana primary: coin type 501
    [true, "org.x402.payto"], // Solana, second payTo
    [true, "org.x402.payto"], // Lightning node key: no coin type
    [true, "addr"], // Robinhood Chain
  ]);
});
