import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPayee, ETH_GRACE_PERIOD, PARENT_CANNOT_CONTROL, NAME_WRAPPER } from "../dist/index.js";

const NOW = 1_800_000_000n;
const YEAR = 365n * 24n * 3600n;
const PAY = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const OTHER = "0x1111111111111111111111111111111111111111";
const ORIGIN = "https://weather.example.workers.dev";
const BASE_COIN = 2147492101n;

function challenge(name = "weather.402api.eth", accepts = [{ network: "eip155:8453", payTo: PAY }]) {
  return { accepts, extensions: name === null ? {} : { "payee-name": { info: { name } } } };
}

/** A fake chain: `texts`/`addrs` keyed by record, `wrapped` keyed by node. */
function reader({
  texts = { "org.x402.origins": ORIGIN },
  addrs = { [BASE_COIN]: PAY },
  slExpiry = NOW + 10n * YEAR,
  wrapped = { "weather.402api.eth": { owner: OTHER, fuses: PARENT_CANNOT_CONTROL, expiry: NOW + 10n * YEAR } },
  fail = null,
} = {}) {
  const maybeFail = (what, value) => (fail === what ? Promise.reject(new Error(`${what} throttled`)) : Promise.resolve(value));
  return {
    now: () => maybeFail("now", NOW),
    text: (_n, key) => maybeFail(`text:${key}`, texts[key] ?? null),
    addr: (_n, coinType) => maybeFail("addr", addrs[coinType] ?? null),
    registryOwner: (node) => maybeFail("registry", wrapped[node] ? NAME_WRAPPER : OTHER),
    wrapperData: (node) => maybeFail("wrapper", wrapped[node]),
    nameExpires: () => maybeFail("expires", slExpiry),
    extendedResolver: () => (fail === "extended" ? Promise.reject(new Error("x")) : Promise.resolve(false)),
  };
}

test("no extension → null", async () => {
  assert.equal(await verifyPayee(challenge(null), ORIGIN, reader()), null);
});

test("bound by addr record", async () => {
  const [v] = await verifyPayee(challenge(), ORIGIN + "/v1/forecast?x=1", reader());
  assert.equal(v.verdict, true);
  assert.equal(v.reason, "payee-bound");
  assert.equal(v.matched_by, "addr");
  assert.equal(v.parent_can_control, false);
  assert.equal(v.accepts_index, 0);
});

test("bound by org.x402.payto, case-insensitive EVM compare", async () => {
  const texts = { "org.x402.origins": ORIGIN, "org.x402.payto": `eip155:8453:${OTHER} eip155:8453:${PAY.toLowerCase()}` };
  const [v] = await verifyPayee(challenge(), ORIGIN, reader({ texts, addrs: {} }));
  assert.equal(v.verdict, true);
  assert.equal(v.matched_by, "org.x402.payto");
});

test("payto listed for another network does not count", async () => {
  const texts = { "org.x402.origins": ORIGIN, "org.x402.payto": `eip155:1:${PAY}` };
  const [v] = await verifyPayee(challenge(), ORIGIN, reader({ texts, addrs: {} }));
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "payto-not-listed");
});

test("verdict is per accept", async () => {
  const pr = challenge("weather.402api.eth", [
    { network: "eip155:8453", payTo: PAY },
    { network: "eip155:8453", payTo: OTHER },
  ]);
  const [a, b] = await verifyPayee(pr, ORIGIN, reader());
  assert.equal(a.verdict, true);
  assert.equal(b.verdict, false);
  assert.equal(b.reason, "payto-not-listed");
  assert.equal(b.accepts_index, 1);
});

test("origin not listed → false (name replay)", async () => {
  const [v] = await verifyPayee(challenge(), "https://impostor.example", reader());
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "origin-not-listed");
  assert.equal(v.detail.expected, "https://impostor.example");
});

test("non-normalized name → false, never silently normalized", async () => {
  const [v] = await verifyPayee(challenge("Weather.402api.eth"), ORIGIN, reader());
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "name-not-normalized");
  assert.equal(v.detail.expected, "weather.402api.eth");
});

test("non-.eth name → inconclusive", async () => {
  const [v] = await verifyPayee(challenge("weather.example.com"), ORIGIN, reader());
  assert.equal(v.verdict, "inconclusive");
  assert.equal(v.reason, "unsupported-name");
});

test("expired subname with the fuse (owner zeroed) → false even though records resolve", async () => {
  const wrapped = { "weather.402api.eth": { owner: "0x0000000000000000000000000000000000000000", fuses: 0, expiry: NOW - 1n } };
  const [v] = await verifyPayee(challenge(), ORIGIN, reader({ wrapped }));
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "name-expired");
});

test("wrapped subname without the fuse: its own expiry does not end it", async () => {
  const wrapped = { "weather.402api.eth": { owner: OTHER, fuses: 0, expiry: 0n } };
  const [v] = await verifyPayee(challenge(), ORIGIN, reader({ wrapped }));
  assert.equal(v.verdict, true);
  assert.equal(v.parent_can_control, true);
});

test("unwrapped subname: parent can control, lives as long as the parent", async () => {
  const [v] = await verifyPayee(challenge(), ORIGIN, reader({ wrapped: {} }));
  assert.equal(v.verdict, true);
  assert.equal(v.parent_can_control, true);
});

test("second-level name in grace → inconclusive; past grace → false", async () => {
  const inGrace = await verifyPayee(challenge(), ORIGIN, reader({ wrapped: {}, slExpiry: NOW - 1n }));
  assert.equal(inGrace[0].reason, "name-in-grace");
  assert.equal(inGrace[0].verdict, "inconclusive");
  const past = await verifyPayee(challenge(), ORIGIN, reader({ wrapped: {}, slExpiry: NOW - ETH_GRACE_PERIOD - 1n }));
  assert.equal(past[0].reason, "name-expired");
});

test("no records at all → inconclusive", async () => {
  const [v] = await verifyPayee(challenge(), ORIGIN, reader({ texts: {}, addrs: {} }));
  assert.equal(v.verdict, "inconclusive");
  assert.equal(v.reason, "no-records");
});

test("a throttled read is inconclusive, never origin-not-listed", async () => {
  for (const what of ["text:org.x402.origins", "addr", "expires", "wrapper", "now"]) {
    const [v] = await verifyPayee(challenge(), ORIGIN, reader({ fail: what }));
    assert.equal(v.verdict, "inconclusive", what);
    assert.equal(v.reason, "resolution-failed", what);
  }
});

test("a failed resolver probe does not sink the verdict", async () => {
  const [v] = await verifyPayee(challenge(), ORIGIN, reader({ fail: "extended" }));
  assert.equal(v.verdict, true);
  assert.equal(v.extended_resolver, "unknown");
});
