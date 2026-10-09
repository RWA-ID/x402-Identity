# Extension: `payee-name`

> **Status:** Draft, for discussion in the x402 Identity WG. Not yet proposed upstream.
> **Addresses:** wg-identity #14 (nothing checkable about a payee is identity), #15 (shared payout addresses), #16 (unsigned payee binding), #23 (payee fragmentation at zero marginal cost).

## Summary

The `payee-name` extension lets a resource server name the operator behind its `payTo` addresses with an [ENS](https://docs.ens.domains) name. The operator's authorization of payout addresses and origins comes from the ENS records of that name. Only the name's owner can set them, and they are set on Ethereum.

A client resolves the name and checks three things:

1. The origin it actually contacted is listed by the name.
2. Each `payTo` it may sign for is listed by the name, on that `network`.
3. The name has not expired.

When all three pass, the client knows the same key holder authorized both the endpoint and the payout address. The check needs no DNS, no TLS-served manifest and no canonicalization, and it works the same way for an operator on a shared platform suffix (`*.workers.dev`, `*.vercel.app`, `*.up.railway.app`) who does not control any DNS.

The extension is **opt-in** and **identifies nothing beyond what the operator chooses to publish**. It does not require reverse records, so payee addresses stay unlinked to each other unless the operator lists them under one name.

---

## Problem

From the WG's own measurements:

- A `payTo` address in a `PaymentRequired` is self-asserted. A `.well-known` manifest served over TLS proves the client reached the host. It does not prove the operator authored the address (wg-identity #14). In a census of 972 hosts serving a discovery manifest, none signed it (#16).
- Domains and payout addresses are many-to-many. One address was advertised by 144 hosts. Many of those hosts are tenants on a platform suffix whose DNS the operator does not control, so a DNS-rooted binding (#16) cannot reach them.
- One operator can mint one address per endpoint at zero cost (132 addresses on one host, #23). Nothing in the payment layer groups them, so address counts cannot be read as operator counts.

What is missing is an **operator-chosen, operator-signed identifier** that can bind several origins and several payout addresses together without depending on DNS.

## Why ENS

- **Signed by construction.** An ENS record is written by a transaction from the name's owner (or an approved manager). Reading it is a verification of that authorization; there is no detached signature to canonicalize.
- **Independent of DNS.** A tenant on `*.workers.dev` can own `weather.example.eth` and list its tenant origin.
- **Many-to-many on purpose.** One name can list many origins and many payout addresses, which addresses the split case (#23) by the operator's own declaration. Rotation is a record update; the name stays.
- **Already chain-aware.** ENSIP-9 / ENSIP-11 address records are keyed by coin type, and a coin type maps from a CAIP-2 `eip155:*` network.

### What it does not solve

- **It is not sybil resistance.** Names are cheap. A name proves *authorization* by one key holder, not that two names belong to different operators. A metric that counts names MUST say so, as #23 requires for addresses.
- **It is not reputation or delivery proof.** A valid binding says who is being paid, not whether they deliver.
- **It does not identify a legal entity.** Any binding to a real-world identity belongs to a separate claim layer.

---

## `PaymentRequired`

The server declares the name once per response:

```json
{
  "x402Version": 2,
  "resource": { "url": "https://weather.example.workers.dev/v1/forecast" },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "1000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      "maxTimeoutSeconds": 60,
      "extra": { "name": "USD Coin", "version": "2" }
    }
  ],
  "extensions": {
    "payee-name": {
      "info": {
        "name": "weather.402api.eth"
      },
      "schema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "minLength": 3,
            "maxLength": 255,
            "description": "An ENS name, ENSIP-15 normalized"
          }
        },
        "required": ["name"],
        "additionalProperties": false
      }
    }
  }
}
```

The name in `info.name` MUST already be [ENSIP-15](https://docs.ens.domains/ensip/15) normalized. A client MUST reject a name whose normalized form differs from the declared form (`name-not-normalized`) instead of normalizing it silently, because lookalike names are the main impersonation vector.

## `PaymentPayload`

Per the core extension rules the client echoes `extensions["payee-name"]` unchanged. The extension adds nothing to the payload, and facilitators need no new behavior to settle a payment that carries it.

### Browser clients

The declaration travels inside `PAYMENT-REQUIRED`, so a browser client on another origin can read it only if the server lists that header in `Access-Control-Expose-Headers`. Nothing else is needed: `EXTENSION-RESPONSES` is the facilitator's verify/settle side channel (core spec §7.2.1), is not forwarded to buyers, and plays no part here. Exposure is uneven today: in a 2026-10-09 sample of 32 Bazaar sellers answering 402, 8 exposed `PAYMENT-REQUIRED` cross-origin.

---

## ENS records

The operator sets these on the name. All of them are standard ENS records, so any resolver that supports ENSIP-5 text records and ENSIP-9/11 address records can serve them.

| Record | Kind | Value | Purpose |
|---|---|---|---|
| `org.x402.origins` | text (ENSIP-5) | Space-separated list of origins (RFC 6454 ASCII serialization, e.g. `https://weather.example.workers.dev`) | Origins allowed to declare this name. **Required.** |
| `addr(coinType)` | address (ENSIP-9/11) | The primary payout address on that chain | Authorizes one `payTo` per chain with no extra record. |
| `org.x402.payto` | text (ENSIP-5) | Space-separated CAIP-10 accounts, e.g. `eip155:8453:0xAbC…` | Authorizes any number of further `payTo` addresses. Optional. |
| `agent-registration[<registry>][<agentId>]` | text ([ENSIP-25](https://docs.ens.domains/ensip/25)) | non-empty | Optional link to an ERC-8004 agent identity. Reported, never required. |

The `org.x402.*` key names follow the ENSIP-5 reverse-DNS convention for service keys and **need the WG's agreement**. Their names should not be treated as settled before that.

### Coin type from network

| `network` (CAIP-2) | ENS coin type |
|---|---|
| `eip155:1` | `60` |
| `eip155:<chainId>`, chainId ≠ 1 | `0x80000000 \| chainId` (ENSIP-11), e.g. Base `eip155:8453` → `2147492101` |
| any other namespace | not mapped by this draft; use `org.x402.payto` |

Records MAY be served through an ENSIP-10 wildcard resolver with EIP-3668 (CCIP-Read). In that case the authority is whichever signer the name's owner configured on its resolver. That is still an owner decision, but the records then sit outside Ethereum state. From outside, a verifier can only tell that a resolver *can* serve records off-chain, so it reports `extended_resolver: true` when the resolver implements ENSIP-10 and does not claim more.

---

## Verification

**Inputs:** the `PaymentRequired` object, and the origin `O` the client actually sent the request to. `O` MUST be taken from the client's own connection, never from `resource.url`, which the server writes.

1. **Name.** Read `extensions["payee-name"].info.name`. If it is absent, the extension does not apply. If it is not ENSIP-15 normalized → `false`, `name-not-normalized`. If it is not under `.eth` → `inconclusive`, `unsupported-name`. This draft defines expiry only for the `.eth` registrar; DNS-imported names are future work.
2. **Resolve** through the ENS Universal Resolver on Ethereum mainnet: `org.x402.origins`, `org.x402.payto`, and `addr(coinType)` for each distinct accept `network`. A transport or RPC failure → `inconclusive`, `resolution-failed`. **A failed read MUST NOT be reported as an absent record.** A throttled RPC and an unset record look alike unless the verifier keeps them apart.
3. **Expiry.** Compute the name's effective expiry: the earliest expiry along its path up to and including the `.eth` second-level name (NameWrapper expiry for wrapped names, BaseRegistrar `nameExpires` for the unwrapped second-level name). An expired ENS name **still resolves**, so this check cannot be skipped.
   - past expiry and grace period → `false`, `name-expired`
   - inside the `.eth` grace period → `inconclusive`, `name-in-grace`
4. **Origin.** If `O` is not an exact member of `org.x402.origins` → `false`, `origin-not-listed`. This check stops a server from declaring a name it does not control. Without it, anyone can put a well-known name in a 402. Listing an origin is an authorization by the name's owner, not a claim to control the host's DNS, so a tenant on a platform suffix can list its tenant origin. A verifier checks only `O` and never contacts the other listed origins, so an origin the operator has stopped serving cannot make a challenge fail.
5. **Payee, per accept.** For each `accepts[i]`, the `payTo` is authorized if it equals `addr(coinType(network))` or `network:payTo` appears in `org.x402.payto`. EVM addresses compare case-insensitively after checksum normalization. Otherwise → `false`, `payto-not-listed`, `accepts_index: i`.
6. **Pass.** All checks hold for an accept → `true`, `payee-bound`, `accepts_index: i`.

A verdict is per accept, as in the Domain Discovery WG verifier schema: a challenge can carry one authorized `payTo` and one that is not.

### Result

The result reuses the field names of the Domain Discovery WG verifier schema (`verdict`, `reason`, `detail`, `accepts_index`, `checked_at`) so one client can read both:

```json
{
  "verdict": true,
  "reason": "payee-bound",
  "accepts_index": 0,
  "name": "weather.402api.eth",
  "matched_by": "addr",
  "expires_at": "2038-05-15T00:00:00Z",
  "parent_can_control": false,
  "extended_resolver": false,
  "checked_at": "2026-10-09T15:04:05Z"
}
```

`parent_can_control` is `false` only when the name is wrapped with `PARENT_CANNOT_CONTROL` burned and unexpired, and `true` or `"unknown"` otherwise. It is **informational**. A name whose parent can rewrite its records is still a valid binding today, but the client should know someone other than the owner can change it.

### Reason codes

A closed, append-only set, which no release renumbers or reuses:

| Code | Verdict | Meaning |
|---|---|---|
| `payee-bound` | `true` | Origin and `payTo` are both listed by an unexpired name. |
| `name-not-normalized` | `false` | `info.name` is not in ENSIP-15 normalized form. |
| `origin-not-listed` | `false` | The contacted origin is not in `org.x402.origins`. `detail` carries the origin. |
| `payto-not-listed` | `false` | The accept's `payTo` is not listed for its network. `detail` carries the network and address. |
| `name-expired` | `false` | The name is past expiry and grace. |
| `name-in-grace` | `inconclusive` | The name is inside the `.eth` grace period. |
| `no-records` | `inconclusive` | The name resolved and none of the records are set. |
| `resolution-failed` | `inconclusive` | Resolution did not complete. Never reported as `false`. |
| `unsupported-name` | `inconclusive` | The name is not under `.eth`, so this draft defines no expiry check for it. |

---

## Client guidance

- A client MAY require `payee-bound` before signing, MAY only display the name, or MAY ignore the extension. The extension mandates no payment policy.
- `inconclusive` MUST NOT be presented as a failed binding.
- When it is shown to a user, the name MUST be the verified name, never the declared one, and only after `payee-bound`.
- Results MAY be cached for at most the challenge's `maxTimeoutSeconds`, keyed by `(name, origin, network, payTo)`.

## Server and operator guidance

- Set `org.x402.origins` before declaring the name. Otherwise every client reports `origin-not-listed`.
- Remove origins you no longer serve. A stale entry fails nothing, but it keeps authorizing whoever controls that hostname next (a reassigned tunnel or platform subdomain) to declare your name. The payee check still applies, so such a host can only direct payments to addresses your name lists.
- Prefer one `addr` record per chain. Use `org.x402.payto` only when you actually rotate or split. Every address listed there is publicly linked to the name.
- Operators who want unlinkable payees can use separate names. The extension never asks for a reverse record.

## Security considerations

- **Name replay:** the origin check (step 4) is what binds a declaration to a server. A verifier that skips it validates nothing.
- **Stale origins:** a listed origin the operator no longer controls can be taken over and declare the name. It passes step 4, but step 5 still limits it to the name's listed `payTo` addresses: it can impersonate the service, not redirect funds.
- **Expiry:** expired names keep resolving and keep passing forward-lookup checks. Step 3 is required.
- **Lookalikes:** step 1 refuses non-normalized names. Rendering the name for humans should follow ENSIP-15 display guidance.
- **Parent control:** subnames whose parent can still control them can be rewritten by the parent. `parent_can_control` exposes this.
- **Resolver trust:** CCIP-Read moves record authority to a gateway signer the owner chose. `extended_resolver` shows a name whose resolver can do this.
- **Liveness:** verification needs an Ethereum mainnet read. A client that cannot reach one gets `inconclusive`, which MUST NOT block payment by default.

## Relationship to other work

- **#16 DNS TXT key authorization:** complementary. DNS serves operators who control their domain. `payee-name` serves the ones who don't, and needs no manifest signature.
- **Domain Discovery verifier schema:** a `payee-name` result is a payee claim, not a terms or delivery claim. It shares field names so one client can consume both, and it does not set `evidence`.
- **ERC-8004 / x402 #931:** a name MAY point at an agent identity with ENSIP-25. ENSIP-25 keys embed the agent id, so they cannot be listed. A client that already holds an `(agentRegistry, agentId)` pair from a registry can confirm the link with one text read. Reputation stays out of this extension.
- **Bazaar:** discovered resources already carry `extensions`. A catalog can filter on `payee-name` and group resources by verified name instead of by address.

## Reference implementation

Planned: `@x402identity/payee`, a `verifyPayee(paymentRequired, origin)` function with no dependencies beyond `viem`, plus a `verify_payee` tool in `@x402identity/mcp`. The x402 Identity Hub availability endpoint will declare `payee-name` as the first live example.
