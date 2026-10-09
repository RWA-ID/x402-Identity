# @x402identity/mcp

MCP (Model Context Protocol) server for the [x402 Identity Hub](https://x402id.eth.link) — lets AI agents check, price, mint, and resolve ENS subname identities under `402bot.eth`, `402api.eth`, and `402mcp.eth`, fully on-chain on Ethereum mainnet, and verify who they are paying before they pay an x402 endpoint.

## Quick start

Add to Claude Desktop / Claude Code / Cursor:

```json
{
  "mcpServers": {
    "x402id": {
      "command": "npx",
      "args": ["-y", "@x402identity/mcp"]
    }
  }
}
```

With no configuration the server runs in **prepare-only** mode: read tools query mainnet directly, and minting tools return a fully-encoded transaction (`to`, `data`, `value`) for you to sign with your own wallet. No keys, no custody.

## Tools

| Tool | What it does |
|---|---|
| `check_availability` | Validate a label and check if `label.parent` is free |
| `get_price` | Total ETH cost for 1–10 mints (protocol fee + optional platform fee) |
| `register_subname` | Mint one subname — prepares or signs (see modes) |
| `batch_register` | Mint up to 10 names in one transaction |
| `resolve_identity` | ENS name → address, owner, text records |
| `list_names` | All x402 names minted by an address (on-chain events) |
| `verify_payee` | Before paying an x402 URL, check that its `payee-name` ENS name authorizes the origin and `payTo` |

## Verifying a payee

`verify_payee` fetches an x402 URL without paying, decodes its 402 challenge and checks the [`payee-name` extension](https://github.com/RWA-ID/x402-Identity/blob/main/specs/extensions/payee-name.md) (draft): the ENS name the endpoint declares must list the origin that answered (`org.x402.origins`) and each `payTo` on its network, and must not be expired.

```json
{
  "origin": "https://x402id-availability.dmpay.workers.dev",
  "payeeName": "test.402api.eth",
  "verdicts": [{ "verdict": true, "reason": "payee-bound", "matched_by": "addr", "parent_can_control": false }]
}
```

`false` comes with a reason (`origin-not-listed`, `payto-not-listed`, `name-expired`, …). `"inconclusive"` (e.g. a failed chain read) is never a refusal. An endpoint that declares no name returns `payeeName: null`. The verifier is also a standalone library, [`@x402identity/payee`](https://github.com/RWA-ID/x402-Identity/tree/main/packages/payee).

## Modes

### Prepare-only (default)

No environment variables needed. `register_subname` returns:

```json
{
  "mode": "prepare-only",
  "name": "myagent.402bot.eth",
  "totalCostEth": "0.0015",
  "transaction": { "to": "0x…", "data": "0x…", "value": "1500000000000000" }
}
```

Sign and broadcast with any wallet.

### Wallet mode (autonomous minting)

```
X402_PRIVATE_KEY=0x…        # the agent's signing key
X402_MAX_SPEND_WEI=…        # optional spend cap per call (default 0.1 ETH)
```

The server signs and broadcasts itself and returns the receipt. Fund the key with a small amount of ETH; the spend cap bounds worst-case loss.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `X402_RPC_URL` | keyless public RPCs | Custom mainnet RPC (note: `list_names` needs full-range `eth_getLogs`) |
| `X402_PRIVATE_KEY` | — | Enables wallet mode |
| `X402_MAX_SPEND_WEI` | `0.1 ETH` | Per-call spend cap in wallet mode |
| `X402_PLATFORM_TREASURY` | — | Earn platform fees: routes single mints through the forwarder |
| `X402_PLATFORM_FEE_WEI` | `0` | Your platform fee per mint (forwarder caps at 0.05 ETH) |

### Platform operators

Just like the [embeddable widget](https://x402id.eth.link/integrate), anyone can run this MCP server with `X402_PLATFORM_TREASURY` + `X402_PLATFORM_FEE_WEI` set and earn a fee on every mint routed through it — paid atomically by the `X402RegistrarForwarder` contract in the same transaction.

## Contracts (Ethereum mainnet, Etherscan-verified)

| Contract | Address |
|---|---|
| `X402SubnameRegistrar` | `0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633` |
| `X402RegistrarForwarder` | `0x05af104ce913e7ef39799bfada871817d3761778` |

Mint fee: 0.0015 ETH per name (read live from the registrar). The parent cannot revoke a minted name (`PARENT_CANNOT_CONTROL` is burned at mint). A name's expiry follows its parent's; the parents are renewed from the x402 treasury and every subname is extended to match, so holders never pay renewals.
