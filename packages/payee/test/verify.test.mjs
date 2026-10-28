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
  assert.deepEqual(v.detail, { field: "network", expected: "a payee listed for eip155:8453", got: "none listed" });
});

test("a payee listed for the network excludes any other payTo on it", async () => {
  const texts = { "org.x402.origins": ORIGIN, "org.x402.payto": `eip155:8453:${OTHER}` };
  const [v] = await verifyPayee(challenge(), ORIGIN, reader({ texts, addrs: {} }));
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "payto-not-listed");
  assert.equal(v.detail.field, "payTo");
});

test("multi-network: Base bound, Lightning with nothing listed gets its own verdict", async () => {
  const LN = "lnbtc:000000000019d6689c085ae165831e93";
  const pr = challenge(undefined, [
    { network: "eip155:8453", payTo: PAY },
    { network: LN, payTo: "02" + "ab".repeat(32) },
  ]);
  const [base, ln] = await verifyPayee(pr, ORIGIN, reader());
  assert.equal(base.verdict, true);
  assert.equal(ln.verdict, false);
  assert.equal(ln.reason, "payto-not-listed");
  assert.equal(ln.detail.got, "none listed");
  assert.equal(ln.accepts_index, 1);
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

const SOL = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOL_PAY = "5yASLjtNssGXDv6bR9e71WXKxRymDiUzbgkGPqkQNgRn";
const SOL_BYTES = "0x49d1f17f96773e0394b5fc9733a877640702059a92e3add52b832835d6c1d5b1";
const DEFAULT_EVM = 2147483648n;
const POLYGON_COIN = 2147483785n;

test("Solana bound by its address record (coin type 501, raw bytes)", async () => {
  const [v] = await verifyPayee(challenge(undefined, [{ network: SOL, payTo: SOL_PAY }]), ORIGIN, reader({ addrs: { 501n: SOL_BYTES } }));
  assert.equal(v.verdict, true);
  assert.equal(v.matched_by, "addr");
});

test("Solana key with leading zero bytes encodes with leading 1s", async () => {
  const bytes = "0x0000" + "07".repeat(30);
  const [v] = await verifyPayee(
    challenge(undefined, [{ network: SOL, payTo: "112QftUJC9yYkE7xr4ikuFmaHKhLCxkpK5RL1J2QqC2" }]),
    ORIGIN,
    reader({ addrs: { 501n: bytes } }),
  );
  assert.equal(v.verdict, true);
});

test("Solana record that isn't 32 bytes never matches", async () => {
  const [v] = await verifyPayee(challenge(undefined, [{ network: SOL, payTo: SOL_PAY }]), ORIGIN, reader({ addrs: { 501n: SOL_BYTES.slice(0, -2) } }));
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "payto-not-listed");
});

test("Solana in org.x402.payto still binds", async () => {
  const texts = { "org.x402.origins": ORIGIN, "org.x402.payto": `${SOL}:${SOL_PAY}` };
  const [v] = await verifyPayee(challenge(undefined, [{ network: SOL, payTo: SOL_PAY }]), ORIGIN, reader({ texts, addrs: {} }));
  assert.equal(v.verdict, true);
  assert.equal(v.matched_by, "org.x402.payto");
});

test("default EVM address binds a chain with no record of its own (ENSIP-19)", async () => {
  const pr = challenge(undefined, [
    { network: "eip155:137", payTo: PAY },
    { network: "eip155:4663", payTo: PAY },
    { network: "eip155:1", payTo: PAY },
  ]);
  const verdicts = await verifyPayee(pr, ORIGIN, reader({ addrs: { [DEFAULT_EVM]: PAY.toLowerCase() } }));
  assert.deepEqual(verdicts.map((v) => [v.verdict, v.matched_by]), [[true, "addr"], [true, "addr"], [true, "addr"]]);
});

test("a chain's own record overrides the default, so the default can't widen it", async () => {
  const pr = challenge(undefined, [{ network: "eip155:137", payTo: PAY }]);
  const [v] = await verifyPayee(pr, ORIGIN, reader({ addrs: { [DEFAULT_EVM]: PAY, [POLYGON_COIN]: OTHER } }));
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "payto-not-listed");
});

test("the default EVM address never binds a non-EVM accept", async () => {
  const [v] = await verifyPayee(challenge(undefined, [{ network: SOL, payTo: SOL_PAY }]), ORIGIN, reader({ addrs: { [DEFAULT_EVM]: PAY } }));
  assert.equal(v.verdict, false);
  assert.equal(v.detail.got, "none listed");
});

test("no EVM accept → the default record is not read", async () => {
  const seen = [];
  const r = reader({ addrs: { 501n: SOL_BYTES } });
  const addr = r.addr;
  r.addr = (n, ct) => (seen.push(ct), addr(n, ct));
  await verifyPayee(challenge(undefined, [{ network: SOL, payTo: SOL_PAY }]), ORIGIN, r);
  assert.deepEqual(seen, [501n]);
});

test("a failed read of the default record is inconclusive", async () => {
  const r = reader();
  r.addr = (_n, ct) => (ct === DEFAULT_EVM ? Promise.reject(new Error("throttled")) : Promise.resolve(PAY));
  const [v] = await verifyPayee(challenge(), ORIGIN, r);
  assert.equal(v.verdict, "inconclusive");
  assert.equal(v.reason, "resolution-failed");
});

/* ENSv2-aware expiry, via the optional secondLevel() reader method. */
const DAY = 24n * 3600n;
const v2Reader = (sl, extra = {}) => ({ ...reader(extra), secondLevel: () => Promise.resolve(sl) });

test("ENSv2 name: its own expiry and a 28-day grace, not the v1 registrar's", async () => {
  const [ok] = await verifyPayee(challenge("airep.eth"), ORIGIN, v2Reader({ expiry: NOW + YEAR, grace: 28n * DAY }, { slExpiry: NOW - YEAR }));
  assert.equal(ok.reason, "payee-bound");
  const [grace] = await verifyPayee(challenge("airep.eth"), ORIGIN, v2Reader({ expiry: NOW - 10n * DAY, grace: 28n * DAY }));
  assert.equal(grace.verdict, "inconclusive");
  assert.equal(grace.reason, "name-in-grace");
  const [gone] = await verifyPayee(challenge("airep.eth"), ORIGIN, v2Reader({ expiry: NOW - 30n * DAY, grace: 28n * DAY }));
  assert.equal(gone.verdict, false);
  assert.equal(gone.reason, "name-expired");
});

test("a released v1 name (grace 0) is expired at once, inside v1's 90 days", async () => {
  const [v] = await verifyPayee(challenge("kafd.eth"), ORIGIN, v2Reader({ expiry: NOW - 74n * DAY, grace: 0n }));
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "name-expired");
});

test("a name that was never registered is expired, with a detail saying so", async () => {
  const [v] = await verifyPayee(challenge("weathr.402api.eth"), ORIGIN, v2Reader({ expiry: 0n, grace: 0n }, { wrapped: {} }));
  assert.equal(v.verdict, false);
  assert.equal(v.reason, "name-expired");
  assert.deepEqual(v.detail, { field: "402api.eth", expected: "registered", got: "not registered" });
  const [lapsed] = await verifyPayee(challenge("kafd.eth"), ORIGIN, v2Reader({ expiry: NOW - 74n * DAY, grace: 0n }));
  assert.equal(lapsed.detail, undefined);
});

test("a reader without secondLevel keeps the v1 grace period", async () => {
  const [v] = await verifyPayee(challenge("weather.eth"), ORIGIN, reader({ slExpiry: NOW - 30n * DAY, wrapped: {} }));
  assert.equal(v.reason, "name-in-grace");
});

test("a failed secondLevel read is inconclusive, never expired", async () => {
  const r = { ...reader(), secondLevel: () => Promise.reject(new Error("throttled")) };
  const [v] = await verifyPayee(challenge("airep.eth"), ORIGIN, r);
  assert.equal(v.verdict, "inconclusive");
  assert.equal(v.reason, "resolution-failed");
});
