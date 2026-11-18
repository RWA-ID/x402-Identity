// payeeCheck: the beforePay hook for @priors/x402's createPayer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { payeeCheck, PayeeRefused } from "../dist/priors.js";
import { PARENT_CANNOT_CONTROL, NAME_WRAPPER } from "../dist/index.js";

const NOW = 1_800_000_000n;
const YEAR = 365n * 24n * 3600n;
const PAY = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const OTHER = "0x1111111111111111111111111111111111111111";
const ORIGIN = "https://agent.example.com";
const RH_COIN = 2147488311n; // Robinhood Chain 4663
const NAME = "agent.402api.eth";

function reader({ texts = { "org.x402.origins": ORIGIN }, addrs = { [RH_COIN]: PAY }, fail = null } = {}) {
  const maybeFail = (what, value) => (fail === what ? Promise.reject(new Error(`${what} throttled`)) : Promise.resolve(value));
  return {
    now: () => maybeFail("now", NOW),
    text: (_n, key) => maybeFail(`text:${key}`, texts[key] ?? null),
    addr: (_n, ct) => maybeFail("addr", addrs[ct] ?? null),
    registryOwner: () => Promise.resolve(NAME_WRAPPER),
    wrapperData: () => Promise.resolve({ owner: OTHER, fuses: PARENT_CANNOT_CONTROL, expiry: NOW + 10n * YEAR }),
    nameExpires: () => Promise.resolve(NOW + 10n * YEAR),
    extendedResolver: () => Promise.resolve(false),
  };
}

// The context exactly as @priors/x402 builds it: frozen, deep-frozen copies.
function deepFreeze(o) {
  if (o && typeof o === "object") {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
function ctx({ name = NAME, payTo = PAY, resource = `${ORIGIN}/v1/quote?x=1`, extensions, signal } = {}) {
  const ext = extensions !== undefined ? extensions : name === null ? null : { "payee-name": { info: { name } } };
  const requirement = { scheme: "exact", network: "eip155:4663", amount: "10000", asset: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", payTo, maxTimeoutSeconds: 60, extra: { name: "Global Dollar", version: "1" } };
  return Object.freeze({
    requirement: deepFreeze(structuredClone(requirement)),
    extensions: deepFreeze(structuredClone(ext)),
    x402Version: 2,
    resource,
    price: 10000n,
    payTo,
    network: "eip155:4663",
    asset: requirement.asset,
    payer: OTHER,
    signal,
  });
}

const refusedWith = (reason) => (e) => {
  assert.ok(e instanceof PayeeRefused, `expected PayeeRefused, got ${e}`);
  if (reason === null) assert.equal(e.verdict, null);
  else assert.equal(e.verdict?.reason, reason);
  return true;
};

test("a bound payee is paid", async () => {
  await payeeCheck({ reader: reader() })(ctx());
});

test("no name declared: paid by default, refused when required", async () => {
  await payeeCheck({ reader: reader() })(ctx({ name: null }));
  await payeeCheck({ reader: reader() })(ctx({ extensions: {} }));
  await assert.rejects(payeeCheck({ reader: reader(), missing: "require" })(ctx({ name: null })), refusedWith(null));
});

test("a payTo the name does not list is refused", async () => {
  await assert.rejects(payeeCheck({ reader: reader() })(ctx({ payTo: OTHER })), refusedWith("payto-not-listed"));
});

test("a name claimed from an origin it does not list is refused", async () => {
  await assert.rejects(
    payeeCheck({ reader: reader() })(ctx({ resource: "https://evil.example.net/v1/quote" })),
    refusedWith("origin-not-listed"),
  );
});

test("a failed chain read holds the payment unless told otherwise", async () => {
  const r = reader({ fail: "text:org.x402.origins" });
  await assert.rejects(payeeCheck({ reader: r })(ctx()), refusedWith("resolution-failed"));
  await payeeCheck({ reader: r, inconclusive: "allow" })(ctx());
});

test("an inconclusive verdict is never allowed to pass a payTo mismatch", async () => {
  // inconclusive: "allow" lets an unreadable chain through, never a definite false
  await assert.rejects(payeeCheck({ reader: reader(), inconclusive: "allow" })(ctx({ payTo: OTHER })), refusedWith("payto-not-listed"));
});

test("the refusal message names the name, the origin and the reason", async () => {
  await assert.rejects(payeeCheck({ reader: reader() })(ctx({ payTo: OTHER })), (e) => {
    assert.match(e.message, /agent\.402api\.eth does not hold for https:\/\/agent\.example\.com \(payto-not-listed\)/);
    return true;
  });
});

test("onVerdict sees every verdict", async () => {
  const seen = [];
  const hook = payeeCheck({ reader: reader(), onVerdict: (v) => seen.push(v.reason) });
  await hook(ctx());
  await hook(ctx({ payTo: OTHER })).catch(() => {});
  assert.deepEqual(seen, ["payee-bound", "payto-not-listed"]);
});

test("the caller's abort signal stops a slow read", async () => {
  const slow = { ...reader(), text: () => new Promise(() => {}) };
  const ac = new AbortController();
  const p = payeeCheck({ reader: slow })(ctx({ signal: ac.signal }));
  ac.abort(new Error("caller gave up"));
  await assert.rejects(p, /caller gave up/);
});

test("a non-http resource is refused, not checked", async () => {
  await assert.rejects(payeeCheck({ reader: reader() })(ctx({ resource: "file:///etc/passwd" })), refusedWith(null));
});

test("bad options fail at setup, not at payment time", () => {
  assert.throws(() => payeeCheck({}), TypeError);
  assert.throws(() => payeeCheck({ reader: reader(), missing: "always" }), TypeError);
  assert.throws(() => payeeCheck({ reader: reader(), inconclusive: "maybe" }), TypeError);
});

test("a payer too old to pass extensions fails closed, not open", async () => {
  const { extensions, ...old } = ctx();
  await assert.rejects(payeeCheck({ reader: reader() })(Object.freeze(old)), (e) => e instanceof PayeeRefused && /upgrade it/.test(e.message));
});
