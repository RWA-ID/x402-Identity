# @x402identity/payee

Reference verifier for the x402 [`payee-name` extension](https://github.com/RWA-ID/x402-Identity/blob/main/specs/extensions/payee-name.md) (draft). An ENS name binds the origin a client contacted to the `payTo` addresses in a 402 challenge, and the binding is signed by the name's owner on Ethereum.

```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { verifyPayee, viemReader } from "@x402identity/payee";

const reader = viemReader(createPublicClient({ chain: mainnet, transport: http(RPC_URL) }));

// `origin` comes from the client's own request, never from `resource.url`.
const verdicts = await verifyPayee(paymentRequired, "https://weather.example.workers.dev", reader);
// null when the challenge does not declare payee-name, else one verdict per accept:
// { verdict: true, reason: "payee-bound", accepts_index: 0, name, matched_by: "addr",
//   expires_at, parent_can_control: false, extended_resolver: false, checked_at }
```

## Operator setup

On the ENS name you declare:

| Record | Value |
|---|---|
| text `org.x402.origins` | `https://weather.example.workers.dev` (space-separated origins) |
| address for the chain you are paid on | your `payTo` (Base = coin type `2147492101`, Solana = `501`) |
| default EVM address (optional) | coin type `2147483648`: your `payTo` on every EVM chain without its own record (EOAs only) |
| text `org.x402.payto` (optional) | further CAIP-10 accounts, space-separated: `eip155:8453:0x…`, or a Lightning node key `lnbtc:000000000019d6689c085ae165831e93:03…` |

Then add to your 402 response:

```json
"extensions": { "payee-name": { "info": { "name": "weather.402api.eth" } } }
```

## Check payees before paying with Priors (`@x402identity/payee/priors`)

A ready-made `beforePay` hook for [`@priors/x402`](https://github.com/priors-agents/priors)'s `createPayer`. It runs after
the payer has picked a requirement and before anything is read, borrowed or signed. A payee whose name does not hold
is refused, and the payer reports `BEFORE_PAY_REFUSED` with this hook's `PayeeRefused` as `cause`.

```js
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { viemReader } from "@x402identity/payee";
import { payeeCheck } from "@x402identity/payee/priors";

const reader = viemReader(createPublicClient({ chain: mainnet, transport: http(MAINNET_RPC_URL) }));
const payer = createPayer({ signer, /* ... */ beforePay: payeeCheck({ reader }) });

try {
  await payer.pay("https://x402fi.dev/g/demo-quote");
} catch (e) {
  if (e.code === "BEFORE_PAY_REFUSED" && e.cause?.name === "PayeeRefused") console.log(e.cause.verdict); // why
}
```

| Option | Default | |
|---|---|---|
| `reader` | required | Ethereum mainnet `EnsReader` (names resolve on mainnet, also for Robinhood Chain payTos) |
| `missing` | `"if-declared"` | A 402 with no payee name: `"if-declared"` pays it, `"require"` refuses it |
| `inconclusive` | `"refuse"` | The chain could not answer (`resolution-failed`, `name-in-grace`, `no-records`): `"refuse"` holds the payment, `"allow"` pays. A definite mismatch is always refused |
| `onVerdict` | | `(verdict, ctx) => void`, called for every verdict reached |

What it checks: the name in the 402's `extensions["payee-name"]` must list the origin of the URL the payer requested in
`org.x402.origins`, and the `payTo` the payer is about to sign for under that network's address record or
`org.x402.payto`. Only the requirement being signed is checked.

The origin is taken from the URL you asked for. `@priors/x402` does not follow redirects unless you set
`init.redirect`, so that is also the origin that answered. If you set `init.redirect: "follow"`, the 402 may come from
another host and the origin half of the check is made against the URL you asked for; the payTo half still holds.

Needs `@priors/x402` with the `extensions` field in the `beforePay` context ([priors-agents/priors#26](https://github.com/priors-agents/priors/pull/26)).
On an older version the hook refuses every payment with a message saying so, rather than silently checking nothing.

## Verdicts

`true` / `false` / `"inconclusive"`, with a reason from a closed set: `payee-bound`, `name-not-normalized`, `origin-not-listed`, `payto-not-listed`, `name-expired`, `name-in-grace`, `no-records`, `resolution-failed`, `unsupported-name`.

A name that was never registered is `name-expired` with `detail.got` = `"not registered"`, so a typo reads differently from a lapsed name.

A failed read is always `inconclusive` / `resolution-failed`. It never reads as an unset record, including a CCIP-Read gateway that is down (viem's non-strict mode would report that as `null`). Expiry is judged on chain time, because an expired ENS name keeps resolving.

## Tests

```sh
npm test                    # unit tests with a fake chain reader
node scripts/live-check.mjs # live mainnet reads against real names
```
