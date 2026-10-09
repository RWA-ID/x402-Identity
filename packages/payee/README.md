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
| address for the chain you are paid on | your `payTo` (Base = coin type `2147492101`) |
| text `org.x402.payto` (optional) | further `eip155:8453:0x…` accounts, space-separated |

Then add to your 402 response:

```json
"extensions": { "payee-name": { "info": { "name": "weather.402api.eth" } } }
```

## Verdicts

`true` / `false` / `"inconclusive"`, with a reason from a closed set: `payee-bound`, `name-not-normalized`, `origin-not-listed`, `payto-not-listed`, `name-expired`, `name-in-grace`, `no-records`, `resolution-failed`, `unsupported-name`.

A failed read is always `inconclusive` / `resolution-failed`. It never reads as an unset record, including a CCIP-Read gateway that is down (viem's non-strict mode would report that as `null`). Expiry is judged on chain time, because an expired ENS name keeps resolving.

## Tests

```sh
npm test                    # unit tests with a fake chain reader
node scripts/live-check.mjs # live mainnet reads against real names
```
