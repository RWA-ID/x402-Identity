# x402 Identity Hub

**ENS subname registration for AI agents — fully onchain on Ethereum.**

Mint subnames under `402bot.eth`, `402api.eth`, or `402mcp.eth` for 0.0015 ETH each. No renewals for holders, no middlemen, and the parent can't take the name back. Parent names are renewed from [$X402ID](#x402id-token) trading fees.

🌐 **Live:** [x402id.dev](https://x402id.dev) · IPFS mirror: [x402id.eth.limo](https://x402id.eth.limo)
🐦 **Twitter/X:** [@x402identity](https://twitter.com/x402identity)

---

## Overview

x402 Identity Hub gives AI agents a verifiable onchain identity through the ENS (Ethereum Name Service) infrastructure. Each minted subname is an ENS record in the NameWrapper contract, locked away from the parent at mint — transferable, resolvable, and composable with the broader ENS ecosystem.

### Available Namespaces

| Name | Purpose |
|------|---------|
| `[name].402bot.eth` | Autonomous AI bots and agents |
| `[name].402api.eth` | API-facing agents and services |
| `[name].402mcp.eth` | MCP (Model Context Protocol) servers |

A name can also prove who gets paid: link it to your x402 endpoint at [x402id.dev/verify](https://x402id.dev/verify/) and clients can check that the payout address in your 402 belongs to you. Setting this up is **free for any .eth name** you control, an x402 name or one you already own, on **ENSv1 or ENSv2**. See [Verified Payee](#verified-payee-payee-name).

---

## Smart Contracts

Two contracts on Ethereum mainnet, both Etherscan-verified.

| Contract | Address | Purpose |
|----------|---------|---------|
| `X402SubnameRegistrar` | [`0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633`](https://etherscan.io/address/0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633) | Mints ENS subnames under the supported parents |
| `X402RegistrarForwarder` | [`0x05af104ce913e7ef39799bfada871817d3761778`](https://etherscan.io/address/0x05af104ce913e7ef39799bfada871817d3761778) | Splits payment between protocol and a third-party platform's treasury in a single tx |

The registrar interacts directly with the ENS **NameWrapper** contract to issue subnames with `PARENT_CANNOT_CONTROL` burned. Key functions:

| Function | Description |
|----------|-------------|
| `register(node, label)` | Mint a single subname |
| `batchRegister(nodes[], labels[])` | Mint multiple subnames in one tx |
| `isAvailable(node, label)` | Check if a subname is available |
| `withdrawFees()` | Owner: withdraw accumulated ETH |

**Mint fee:** 0.0015 ETH per name (protocol fee, set on-chain by `setMintFee`; clients read `mintFee()`)  
**Batch:** Up to 10 names per transaction  
**Platform fee:** 0–0.05 ETH on top of the protocol fee, paid to a platform's treasury via the forwarder (see below)

**ENSv2.** ENS moved new registrations to ENSv2 on 2026-10-27. The three parents are unmigrated ENSv1 names, and minting through the NameWrapper keeps working for them (checked by simulating `register` on mainnet after the launch). They must stay on ENSv1: a parent migrated to ENSv2 would need a new registrar that calls `register()` on its subregistry.

---

## Minting and payout records

Minting sets a subname's owner and resolver but writes no address record, so a fresh name resolves to nothing. After a mint, and in **Set address** for a name you already hold, the site asks where the name should say you get paid, then writes everything in one multicall:

- **Ethereum and Base**: always.
- **Every other EVM chain** through the ENSIP-19 default address (`addr(0x80000000)`). Pre-checked only when the wallet has no contract code on Ethereum and Base (an EIP-7702 delegation still counts as an EOA). A contract wallet's address can belong to someone else on a chain where it was never deployed, so the default is never offered to one, and a failed check keeps it off.
- **Chain-specific records** for the chains x402 sellers use most, for wallets that don't read the default: Polygon, Arbitrum, World Chain, Monad, X Layer, BNB Chain, HyperEVM, Robinhood Chain, Avalanche and Optimism.
- **A Solana address**, optional, written as `addr(501)`.

The wallet sees the choice before it is asked to sign. Only address records are written, so any `org.x402.payto` set through `/verify` is left alone. The mint and address transactions suggest a low tip (the network's estimate with a 0.01 gwei floor) instead of the wallet's default; a wallet that applies its own fees can still override it.

---

## Platform Integration

External platforms can earn from registrations by mounting the x402id widget and setting their own platform fee — paid atomically to a treasury address they specify. The forwarder enforces a 0.05 ETH cap on platform fees and the breakdown is shown to users line-by-line before they sign.

**Full integration guide:** [x402id.dev/integrate](https://x402id.dev/integrate/)

### Option 1 — drop-in for any site

```html
<div data-x402id
     data-treasury="0xYourPlatformTreasury"
     data-platform-fee-wei="1000000000000000"
     data-parents="402bot.eth,402api.eth,402mcp.eth"
     data-theme="light"></div>
<script src="https://x402id.eth.link/embed.js" async></script>
```

`data-theme` takes `light`, `dark`, `lime`, `orange`, or `purple`. Try them at [/widget-demo](https://x402id.dev/widget-demo/).

### Option 2 — React / Next.js

```bash
npm install @x402identity/widget-react viem
```

```tsx
import { X402Widget } from "@x402identity/widget-react";
import { mainnet } from "viem/chains";
import { namehash, parseEther } from "viem";

<X402Widget
  registrar="0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633"
  forwarder="0x05af104ce913e7ef39799bfada871817d3761778"
  parents={[
    { label: "402bot.eth", node: namehash("402bot.eth") },
    { label: "402api.eth", node: namehash("402api.eth") },
    { label: "402mcp.eth", node: namehash("402mcp.eth") },
  ]}
  platformTreasury="0xYourPlatformTreasury"
  platformFeeWei={parseEther("0.001")}
  chain={mainnet}
/>
```

Already have a wallet modal (Reown AppKit, RainbowKit)? Pass your wagmi clients and a connect handler so the widget uses the same wallet instead of `window.ethereum` (`onConnect` needs `widget-react` 0.5.0+):

```tsx
const { address } = useAccount();
const publicClient = usePublicClient();
const { data: walletClient } = useWalletClient();
const { open } = useAppKit(); // or RainbowKit's useConnectModal().openConnectModal

<X402Widget
  {...props}
  account={walletClient ? address : undefined}
  publicClient={publicClient}
  walletClient={walletClient}
  onConnect={() => open()}
/>
```

After the mint confirms, the widget points the new name's Ethereum and Base records at the minter in one multicall.

**Current versions:** `@x402identity/widget-react` 0.6.2 on `@x402identity/widget-core` 0.7.0. Use widget-react 0.6.1 or later: 0.6.0 depended on `widget-core ^0.4.0`, which on a 0.x version installs only the 0.4 line. That line looks up resolvers through the Universal Resolver's `findResolver`, which since ENSv2 returns a wrapper contract instead of the name's resolver, so its set-address step fails.

### Widget repo layout

| Path | What it is |
|------|------------|
| `contracts/X402RegistrarForwarder.sol` | Payment-splitting forwarder, ERC1155-receiver, owner-tunable fee cap |
| `packages/widget-core/` | Framework-agnostic viem helpers (ABIs, validation, tx builders, ENSv1/ENSv2 record reads and writes) |
| `packages/widget-react/` | `<X402Widget>` component; uses the host wallet via `onConnect`, else `window.ethereum`; zero-dep styling |
| `packages/mcp-server/` | `@x402identity/mcp` — MCP server for agents (see below) |
| `packages/payee/` | `@x402identity/payee` — verifier for the `payee-name` extension (see [Verified Payee](#verified-payee-payee-name)) |
| `packages/embed/embed.js` | Vanilla script-tag loader for non-React sites — **edit this one** |
| `public/embed.js` | Generated copy of the above (`npm run sync:embed`, runs on every build) |
| `src/app/widget/` | Standalone widget page (iframe target for `embed.js`) |
| `src/app/integrate/` | Public integrator-facing docs page |
| `src/app/verify/` | Verified Payee wizard: link a name to an x402 endpoint |

---

## MCP Server

`@x402identity/mcp` lets an AI agent claim and manage its own ENS identity directly — no browser, no widget. It speaks the [Model Context Protocol](https://modelcontextprotocol.io), so it drops into Claude Desktop, Claude Code, Cursor, or any MCP client.

**npm:** [`@x402identity/mcp`](https://www.npmjs.com/package/@x402identity/mcp) (current: 0.3.3) · **source:** [`packages/mcp-server/`](packages/mcp-server)

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

### Tools

| Tool | What it does |
|------|--------------|
| `check_availability` | Validate a label and check if `label.parent` is free |
| `get_price` | Total ETH cost for 1–10 mints (protocol fee + optional platform fee) |
| `register_subname` | Mint one permanent subname |
| `batch_register` | Mint up to 10 names in one transaction |
| `resolve_identity` | ENS name → Ethereum, Base and Solana (`addr(501)`) addresses, the ENSIP-19 default EVM address, owner and text records. The Base address falls back to the default EVM address, and `baseSource` says which applied |
| `list_names` | All x402 names minted by an address (onchain events) |
| `verify_payee` | Before paying an x402 URL, check that its `payee-name` ENS name authorizes the origin and `payTo`. Covers EVM, Solana and Lightning payouts and ENSv1 and ENSv2 names (on `@x402identity/payee` 0.3.0) |

### Modes

**Prepare-only (default)** — zero configuration, zero custody. Read tools query mainnet directly; mint tools return a fully-encoded transaction (`to`, `data`, `value`) for the caller to sign with any wallet.

**Wallet mode** — set `X402_PRIVATE_KEY` and the server signs and broadcasts itself, returning the receipt. `X402_MAX_SPEND_WEI` (default 0.1 ETH) bounds worst-case loss per call.

| Env var | Default | Purpose |
|---------|---------|---------|
| `X402_RPC_URL` | keyless public RPCs | Custom mainnet RPC (`list_names` needs full-range `eth_getLogs`) |
| `X402_PRIVATE_KEY` | — | Enables wallet mode |
| `X402_MAX_SPEND_WEI` | 0.1 ETH | Per-call spend cap in wallet mode |
| `X402_PLATFORM_TREASURY` | — | Route mints through the forwarder and earn a platform fee |
| `X402_PLATFORM_FEE_WEI` | `0` | Platform fee per mint (forwarder caps at 0.05 ETH) |

Like the widget, anyone can run this server with a treasury configured and earn on every mint routed through it — paid atomically by `X402RegistrarForwarder` in the same transaction.

**Full docs:** [`packages/mcp-server/README.md`](packages/mcp-server/README.md)

---

## Agentic Market / x402 Bazaar

x402 Identity Hub is listed on [agentic.market](https://agentic.market/services/x402id-availability-dmpay-workers-dev) through the x402 Bazaar, as a paid name-availability check:

```
GET https://api.x402id.dev/v1/availability/:name                          # e.g. mybot.402bot.eth
GET https://x402id-availability.dmpay.workers.dev/v1/availability/:name    # same worker, original URL (kept)
```

It costs **$0.001 USDC on Base** (x402), paid to the x402 Safe [`0x8E61…631C`](https://app.safe.global/home?safe=base:0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C), and returns `available`, the live mint fee and a link to register here. It's there for discovery: someone browsing the marketplace asks their agent to check a name, and the answer sends them to the site. A malformed name or a failed chain read is never charged.

Its 402 declares `payee-name: x402id.402api.eth`, the live reference instance for [Verified Payee](#verified-payee-payee-name). The same worker serves these free routes:

| Route | Purpose |
|-------|---------|
| `GET /v1/challenge?url=…` | Reads another endpoint's 402 server-side and returns only its payment terms, for `/verify/` (most sellers don't expose `PAYMENT-REQUIRED` to browsers). https on public hostnames only, 30 reads/min per IP |
| `GET /v1/manifest?url=…` | Reads a host's `/.well-known/x402` and returns only its listed routes (own host and subdomains) and `payee-name`, for `/verify/`. Same limits as `/v1/challenge` |
| `GET /.well-known/agent-registration.json` | ERC-8004 registration file for agent `8453:98739`; its last ENS service is the payee `x402id.402api.eth` |
| `GET /.well-known/x402` | x402 host manifest ([x402#2979](https://github.com/x402-foundation/x402/pull/2979) shape) listing the paid route, with an `extensions["payee-name"]` pointer. x402id.dev serves the same manifest via a service binding. It validates against the [wg-domain-discovery#8](https://github.com/x402-foundation/wg-domain-discovery/pull/8) schema, format checking included |

**Source + deploy:** [`workers/availability/`](workers/availability)

---

## Verified Payee (`payee-name`)

A client paying an x402 endpoint can't tell who the `payTo` address belongs to. `payee-name` fixes that with an ENS name: the 402 declares the name, and the name's owner lists the origins and payout addresses it authorizes. Those records are set by the owner's key on Ethereum, so the check needs no DNS. It works for a seller on `*.workers.dev` or `*.vercel.app` who controls no domain.

**Set it up:** [x402id.dev/verify](https://x402id.dev/verify/) runs a three-step wizard. It is **free for any .eth name** (no fee from us; the wallet pays only Ethereum's network fee for the record write) and works with **ENSv1 and ENSv2** names.

1. **Choose names**: every .eth name the wallet controls: x402 names, wrapped and unwrapped ENSv1 names, and names registered or upgraded on ENSv2. Each carries an **ENSv1** or **ENSv2** badge. A name that can't take records yet is shown with the reason and what to do (expired but renewable, a registrant who isn't the manager, no resolver, a custom or offchain resolver, the 2020 Public Resolver on a wrapped name, or an ENSv2 name still on its previous owner's resolver). Names the wallet no longer controls, or that expired and were released, are left out. Any other .eth name, including an unwrapped subname, can be added by hand.
2. **Link endpoints**: paste a paid route. The page reads its 402 and fills in the origin and payout addresses, shows the current and new records side by side, and writes them in one signature per resolver. Payouts can also be entered by hand, including Solana and Bitcoin Lightning.
3. **Verify**: add one line to your 402 and redeploy. The page checks the records and the declaration, and shows **Verified payee** when both pass.

**What gets written** on the name:

| Record | Value |
|--------|-------|
| text `org.x402.origins` | Origins allowed to declare the name (space-separated, exact RFC 6454 origins, no wildcards) |
| address record per chain | The primary `payTo` on that chain: Base = coin type `2147492101`, Solana mainnet = `501` (the 32-byte public key) |
| text `org.x402.payto` | Further CAIP-10 payout accounts, if any, and accounts with no coin type. A Lightning `payTo` is the node's 66-hex public key, e.g. `lnbtc:000000000019d6689c085ae165831e93:<node key>`, never a `bip122` address |

For any EVM network with no address record of its own, the verifier falls back to the ENSIP-19 default EVM address `addr(0x80000000)`. ENS's PublicResolver doesn't apply that fallback itself, so the verifier does; a chain's own record always wins, and the default never applies to a non-EVM network.

On an ENSv2 name the same records sit on its Permissioned Resolver, which takes the DNS-encoded name in its setters and answers reads only through `resolve()`. The wizard and `@x402identity/widget-core` handle both forms.

**What the server adds** to its x402 route config:

```ts
extensions: {
  "payee-name": { info: { name: "myagent.402bot.eth" } },
},
```

**Checking it from code or an agent:**

| Package | Use |
|---------|-----|
| [`@x402identity/payee`](https://www.npmjs.com/package/@x402identity/payee) 0.3.1 | `verifyPayee(paymentRequired, origin, reader)`: one verdict per payment option, `true` / `false` / `"inconclusive"` with a reason |
| [`@x402identity/mcp`](https://www.npmjs.com/package/@x402identity/mcp) 0.3.3 | `verify_payee` tool: give it a URL, it reads the 402 and verifies it |
| [`@x402identity/widget-core`](https://www.npmjs.com/package/@x402identity/widget-core) 0.7.0 | `planPayeeRecords` / `payeeWrites` / `readPayeeRecords`: the record writes and reads the wizard uses, for ENSv1 and ENSv2 names (`buildPayeeCalls` for ENSv1 only) |

A failed chain read is always `inconclusive`, never a refusal. Expiry is checked on chain time, because an expired ENS name keeps resolving. Since ENSv2, the ETH registry's `getStatus` decides how a `.eth` name's expiry is read: an ENSv2 name uses its own expiry and a 28-day grace period; an unmigrated ENSv1 name uses the BaseRegistrar expiry and 90 days; and a name ENSv2 lists as available has been released, so it is expired even inside those 90 days.

**Spec and status:** the draft is [`specs/extensions/payee-name.md`](specs/extensions/payee-name.md), proposed to the x402 Foundation in [wg-identity#36](https://github.com/x402-foundation/wg-identity/issues/36) and [x402#3755](https://github.com/x402-foundation/x402/issues/3755). The record format (the `org.x402.*` key names, exact origin matching, and CAIP-10 for accounts without a coin type) was [endorsed as written on #36](https://github.com/x402-foundation/wg-identity/issues/36#issuecomment-6458232352) on 2026-10-28. Live reference: the availability worker's 402 declares `x402id.402api.eth` and verifies as `payee-bound` on mainnet.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.20 · OpenZeppelin v5 · Hardhat |
| Frontend | Next.js 14 · React 18 · TypeScript |
| Web3 | wagmi v2 · viem v2 · Reown AppKit (WalletConnect) |
| Chain data | Alchemy (paid, domain-allowlisted browser key: mainnet and Base RPC, NFT API for name listing) |
| Styling | Tailwind CSS · Framer Motion |
| Agent interface | Model Context Protocol SDK · zod |
| Workers | Cloudflare Workers · Hono · `@x402/hono` |
| Hosting | Cloudflare Workers (x402id.dev) · IPFS (Pinata) · ENS contenthash |

---

## Hosting

The frontend is a static export (`next build` → `out/`), deployed twice from the same build:

- **[x402id.dev](https://x402id.dev)**: the `x402id-site` Cloudflare Worker (`workers/site/`, `npx wrangler deploy`). `www.x402id.dev`, `402id.dev` and `www.402id.dev` 301 to it.
- **[x402id.eth.limo](https://x402id.eth.limo)**: pinned to IPFS and served via the `x402id.eth` ENS contenthash. No centralized server required.

The workers keep their `*.workers.dev` URLs alongside `api.x402id.dev` and `swap.x402id.dev`; those URLs are cataloged elsewhere and must never be retired.

**IPFS CID:** `bafybeicr65ajg2ovhviurjsd4wkqtfulqlpzwpl32uw2d2gxjie344e3e4`

```
https://ipfs.io/ipfs/bafybeicr65ajg2ovhviurjsd4wkqtfulqlpzwpl32uw2d2gxjie344e3e4/
```

---

## Local Development

### Prerequisites

- Node.js 18+
- An Alchemy API key
- A WalletConnect project ID (from [cloud.reown.com](https://cloud.reown.com))

### Setup

```bash
git clone https://github.com/RWA-ID/x402-Identity.git
cd x402-Identity
npm install
```

Create `.env.local`:

```env
# Read by the site (all of them end up in the browser bundle)
NEXT_PUBLIC_REOWN_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_ALCHEMY_SITE_KEY=your_browser_alchemy_key
NEXT_PUBLIC_SWAP_API=https://x402id-swap.dmpay.workers.dev   # the default when unset

# Read by Hardhat and the Node scripts only, never by the site
NEXT_PUBLIC_ALCHEMY_MAINNET=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_ALCHEMY_BASE=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_ALCHEMY_SEPOLIA=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...            # deploy / setup / expiry scripts
ETHERSCAN_API_KEY=...        # contract verification, expiry and cashback scripts
PINATA_JWT=...               # scripts/upload-ipfs.mjs
```

`NEXT_PUBLIC_ALCHEMY_SITE_KEY` is the browser's key. In production it is domain-allowlisted, which also means it rejects requests that carry no `Origin`, so the scripts and Hardhat use the separate `NEXT_PUBLIC_ALCHEMY_MAINNET` / `_BASE` URLs. For local development, use a key whose allowlist includes `localhost`, or leave it unset: chain reads then fall back to public RPCs, but the wizard can't list a wallet's names (you can still add them by hand).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
# Output: ./out/ (static export ready for IPFS)
```

The site imports the packages' built `dist/`, so rebuild a package (`npm run build` in `packages/<name>`) before building the site after changing it.

---

## Contract Development

```bash
# Compile contracts
npx hardhat compile --config hardhat.config.js

# Run tests
npx hardhat test --config hardhat.config.js

# Deploy (requires PRIVATE_KEY in .env.local)
node scripts/deploy-viem.mjs

# Setup parent nodes (after deployment)
node scripts/setup-viem.mjs
```

---

## Testing

| What | How |
|------|-----|
| Verifier unit tests | `cd packages/payee && npm test` (30 tests: records, default EVM and Solana, Lightning, expiry and grace on ENSv1 and ENSv2, failed reads) |
| Mint and record writes on a mainnet fork | `anvil --fork-url <mainnet rpc> --port 8547`, then `node scripts/fork-ensv2-check.mjs`: mints through the widget and site paths, writes records through `widget-core`, and verifies them through the official Universal Resolver |
| Payee writes on real names | Same fork, `node scripts/fork-names-check.mjs` (`HOLDER` and `NAMES` env vars): writes payee records to ENSv1 and ENSv2 names as their holder, one transaction per resolver, and verifies each `payee-bound` |

---

## Project Structure

```
x402-identity-hub/
├── contracts/
│   ├── X402SubnameRegistrar.sol   # Core registrar contract
│   └── X402RegistrarForwarder.sol # Platform-fee payment splitter
├── packages/
│   ├── widget-core/               # Framework-agnostic viem helpers; ensv2.ts = ENSv2 registry + resolver
│   ├── widget-react/              # <X402Widget> React component
│   ├── embed/                     # Script-tag loader — source of truth for public/embed.js
│   ├── mcp-server/                # @x402identity/mcp (MCP server)
│   └── payee/                     # @x402identity/payee (payee-name verifier)
├── scripts/
│   ├── deploy-viem.mjs            # Mainnet deploy script (viem)
│   ├── setup-viem.mjs             # NameWrapper approval + parent setup
│   ├── extend-subname-expiry.mjs  # Extend every subname to its parent's expiry after a renewal
│   ├── fork-ensv2-check.mjs       # Mint + record writes on a mainnet fork
│   ├── fork-names-check.mjs       # Payee writes on real ENSv1/ENSv2 names on a fork
│   ├── cashback/                  # $X402ID mint cashback rounds (Safe batches + records)
│   └── upload-ipfs.mjs            # IPFS folder upload (Pinata)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + providers
│   │   ├── page.tsx               # Home page
│   │   ├── verify/                # Verified Payee wizard
│   │   └── globals.css            # Global styles
│   ├── components/
│   │   ├── MintForm.tsx           # Main mint UI (single + batch)
│   │   ├── PayoutPicker.tsx       # Post-mint payout records (EVM chains, default EVM, Solana)
│   │   ├── SetAddressPanel.tsx    # Set payout records on a name you hold
│   │   ├── EnsReady.tsx           # ENSv1 / ENSv2 badges + "ENSv1 and ENSv2 ready" card
│   │   ├── ConnectButton.tsx      # Wallet connect button
│   │   ├── RecentMints.tsx        # Live mint feed
│   │   ├── SuccessModal.tsx       # Post-mint confirmation + share
│   │   ├── TokenSwap.tsx          # $X402ID swap panel (Base, via workers/swap)
│   │   └── WalletConnectErrorBoundary.tsx
│   └── lib/
│       ├── wagmi.ts               # wagmi config + connectors
│       ├── alchemy.ts             # Browser Alchemy key (RPC + NFT API)
│       ├── names.ts               # Which .eth names a wallet can write payee records to (ENSv1 + ENSv2)
│       ├── payout.ts              # Payout picker chains and record calldata
│       ├── payto.ts               # Per-network payout validation (EVM, Solana, Lightning)
│       ├── contracts.ts           # Contract addresses + ABI
│       ├── token.ts               # $X402ID constants + swap API URL
│       └── parents.ts             # Parent node configs (namehashes)
├── specs/
│   └── extensions/payee-name.md   # Draft x402 extension (proposed upstream)
├── workers/
│   ├── availability/              # Paid x402 name check + free /v1/challenge + /v1/manifest readers
│   ├── site/                      # Serves the static export at x402id.dev
│   └── swap/                      # Cloudflare Worker proxying the 0x Swap API
├── hardhat.config.js
├── next.config.mjs
└── tailwind.config.ts
```

---

## ENS Infrastructure

Each minted subname is registered through the ENS **NameWrapper** at `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`.

The registrar must be approved as an operator on each parent name before registrations can occur. This is handled once during deployment via `setApprovalForAll` on the NameWrapper.

Parent node hashes used internally:
- `402bot.eth` → `namehash("402bot.eth")`
- `402api.eth` → `namehash("402api.eth")`
- `402mcp.eth` → `namehash("402mcp.eth")`

Record writes look the name's resolver up at write time, never hardcoded or cached: from the ENS registry for an ENSv1 name, and from the ENSv2 ETH registry for an ENSv2 name. Since ENSv2, the Universal Resolver's `findResolver` returns the `ENSV1Resolver` wrapper for every ENSv1 name, so it can't be used to find where to write.

---

## Parent Name Renewals

A subname's expiry is capped at its parent's, so the parents are the one thing that must be kept alive. Current expiries (NameWrapper, read live on the site):

| Parent | Expiry |
|--------|--------|
| `402bot.eth` | May 2039 |
| `402api.eth` | May 2038 |
| `402mcp.eth` | May 2038 |

Parents are renewed from **$X402ID trading fees**, which accrue in WETH to the x402 treasury Safe. Renewals are the first call on that treasury, ahead of development and buybacks. After each renewal, `scripts/extend-subname-expiry.mjs` extends every existing subname to match — holders never pay or act. Since ENSv2, renewing an unmigrated ENSv1 name goes through ENS's `ETHRenewerV1`.

---

## $X402ID Token

| | |
|---|---|
| Token | [`0xb9490fc272642A7De0539FB3dC52A2769936FBa3`](https://basescan.org/token/0xb9490fc272642A7De0539FB3dC52A2769936FBa3) on Base, launched 2026-09-26 via Bankr |
| Supply | 100,000,000,000, fixed |
| Liquidity | 85% in a Uniswap v4 pool paired with WETH |
| Treasury | 15% vesting over 1 year (30-day cliff) to the x402 Safe [`0x8E61…631C`](https://app.safe.global/home?safe=base:0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C) (2-of-3) |
| Trading fees | 0.665% of volume to the Safe in WETH |
| Mint cashback | 25% of the mint fee back in $X402ID for every name registered since launch, sent by the Safe on Base in monthly rounds from 2026-10-26 (nothing to claim) |

### Cashback rounds

Each round is built by `scripts/cashback/round.mjs` and paid as one Safe batch. Its record, with every mint, the price and the calldata, is in [`scripts/cashback/rounds/`](scripts/cashback/rounds/). Team wallets (the deployer, the Safe and its owners) are excluded. Amounts are valued at the mean daily X402ID/WETH close across the round.

**Round 1** (2026-09-26 → 2026-10-26), paid 2026-10-26 in [`0x7f656ed0…ed96`](https://basescan.org/tx/0x7f656ed03e24f2431b4f293d0670dda831c7e148e338cdebf07b8765c343ed96), the same batch that released the first 1,233,170,662 X402ID from vesting at the cliff:

| Recipient | For | Fee paid | X402ID |
|---|---|---|---|
| [`0xfA6b24f09F51C49aB35ce49a40058b14eaaD3869`](https://basescan.org/address/0xfA6b24f09F51C49aB35ce49a40058b14eaaD3869) | `eac.402bot.eth`, `888.402bot.eth` | 2 × 0.0015 ETH | 9,195,728 |
| [`0x866F5DA24591B2401F04C1F3Dd0cBc799Bb52fdf`](https://basescan.org/address/0x866F5DA24591B2401F04C1F3Dd0cBc799Bb52fdf) | Genesis: first outside minter, before launch | 0.01 ETH | 30,652,429 |
| **Total** | | | **39,848,157** |

The site's swap panel quotes through `workers/swap/`, a Cloudflare Worker that holds the 0x API key and pins every quote to ETH ↔ X402ID on Base with a 0.10% fee to the Safe.

$X402ID is a utility token. It is not an investment and carries no claim on revenue.

---

## Changelog (October 2026)

| Date | Change |
|------|--------|
| 10-20 | Homepage verified-payee section; hero redesign |
| 10-23 | Post-mint payout picker: Ethereum + Base, ENSIP-19 default EVM address (EOAs only), chain-specific records, Solana `addr(501)`; low suggested tip on mints. `/verify` manual entry for Solana and Bitcoin Lightning; labels for more EVM chains. **payee 0.2.0 / widget-core 0.6.0** (Solana, default EVM fallback). **mcp 0.3.0** (`verify_payee`) |
| 10-24 | **mcp 0.3.1**: `resolve_identity` returns Solana and the default EVM address. Cashback round script |
| 10-25 | The availability endpoint's payee moves to `x402id.402api.eth`; ERC-8004 agent 98739 lists it |
| 10-26 | Cashback round 1 paid on Base |
| 10-27 | ENSv2 launch fix: write resolvers come from the ENS registry, not `findResolver` (**widget-core 0.6.1, payee 0.2.1, widget-react 0.6.1, mcp 0.3.2**; widget-react's dependency range corrected). The wizard lists names with the Alchemy NFT API instead of Etherscan, so it no longer hits Etherscan's rate limit |
| 10-28 | `/verify` works for any .eth name, free: ENSv1 (wrapped, unwrapped, subnames) and ENSv2, with version badges and the "ENSv1 and ENSv2 ready" card. **widget-core 0.7.0, payee 0.3.0, widget-react 0.6.2, mcp 0.3.3**. Spec records the #36 decisions and the ENSv2 expiry rule. **payee 0.3.1**: a `.eth` name that was never registered says so in `detail` (suggested by the first outside implementer on #36) |

---

## Contact

📧 [x402id@onchain-id.id](mailto:x402id@onchain-id.id)

---

## License

MIT
