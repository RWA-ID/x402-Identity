# x402 Identity Hub

**ENS subname registration for AI agents — fully onchain on Ethereum.**

Mint subnames under `402bot.eth`, `402api.eth`, or `402mcp.eth` for 0.0015 ETH each. No renewals for holders, no middlemen, and the parent can't take the name back. Parent names are renewed from [$X402ID](#x402id-token) trading fees.

🌐 **Live:** [x402id.eth.link](https://x402id.eth.link)
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

---

## Platform Integration

External platforms can earn from registrations by mounting the x402id widget and setting their own platform fee — paid atomically to a treasury address they specify. The forwarder enforces a 0.05 ETH cap on platform fees and the breakdown is shown to users line-by-line before they sign.

**Full integration guide:** [x402id.eth.link/integrate](https://x402id.eth.link/integrate)

### Option 1 — drop-in for any site

```html
<div data-x402id
     data-treasury="0xYourPlatformTreasury"
     data-platform-fee-wei="1000000000000000"
     data-parents="402bot.eth,402api.eth,402mcp.eth"
     data-theme="light"></div>
<script src="https://x402id.eth.link/embed.js" async></script>
```

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

### Widget repo layout

| Path | What it is |
|------|------------|
| `contracts/X402RegistrarForwarder.sol` | Payment-splitting forwarder, ERC1155-receiver, owner-tunable fee cap |
| `packages/widget-core/` | Framework-agnostic viem helpers (ABIs, validation, tx builders) |
| `packages/widget-react/` | `<X402Widget>` component; uses the host wallet via `onConnect`, else `window.ethereum`; zero-dep styling |
| `packages/mcp-server/` | `@x402identity/mcp` — MCP server for agents (see below) |
| `packages/embed/embed.js` | Vanilla script-tag loader for non-React sites — **edit this one** |
| `public/embed.js` | Generated copy of the above (`npm run sync:embed`, runs on every build) |
| `src/app/widget/` | Standalone widget page (iframe target for `embed.js`) |
| `src/app/integrate/` | Public integrator-facing docs page |

---

## MCP Server

`@x402identity/mcp` lets an AI agent claim and manage its own ENS identity directly — no browser, no widget. It speaks the [Model Context Protocol](https://modelcontextprotocol.io), so it drops into Claude Desktop, Claude Code, Cursor, or any MCP client.

**npm:** [`@x402identity/mcp`](https://www.npmjs.com/package/@x402identity/mcp) · **source:** [`packages/mcp-server/`](packages/mcp-server)

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
| `resolve_identity` | ENS name → address, owner, text records |
| `list_names` | All x402 names minted by an address (onchain events) |

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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.20 · OpenZeppelin v5 · Hardhat |
| Frontend | Next.js 14 · React 18 · TypeScript |
| Web3 | wagmi v2 · viem v2 · WalletConnect |
| Styling | Tailwind CSS · Framer Motion |
| Agent interface | Model Context Protocol SDK · zod |
| Hosting | IPFS (Pinata) · ENS contenthash |

---

## Hosting

The frontend is a static export (`next build` → `out/`) pinned to IPFS and served via the `x402id.eth` ENS contenthash. No centralized server required.

**IPFS CID:** `bafybeifchzkaxfof5tek2xtgvypncpccs2wh5pxg7ltsg76ooevivecfga`

```
https://ipfs.io/ipfs/bafybeifchzkaxfof5tek2xtgvypncpccs2wh5pxg7ltsg76ooevivecfga/
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
NEXT_PUBLIC_REOWN_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_ALCHEMY_MAINNET=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_ALCHEMY_SEPOLIA=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_REGISTRAR_ADDRESS=0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633
NEXT_PUBLIC_CHAIN_ID=1
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
# Output: ./out/ (static export ready for IPFS)
```

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

## Project Structure

```
x402-identity-hub/
├── contracts/
│   ├── X402SubnameRegistrar.sol   # Core registrar contract
│   └── X402RegistrarForwarder.sol # Platform-fee payment splitter
├── packages/
│   ├── widget-core/               # Framework-agnostic viem helpers
│   ├── widget-react/              # <X402Widget> React component
│   ├── embed/                     # Script-tag loader — source of truth for public/embed.js
│   └── mcp-server/                # @x402identity/mcp (MCP server)
├── scripts/
│   ├── deploy-viem.mjs            # Mainnet deploy script (viem)
│   ├── setup-viem.mjs             # NameWrapper approval + parent setup
│   └── upload-ipfs.mjs            # IPFS folder upload (Pinata)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + providers
│   │   ├── page.tsx               # Home page
│   │   └── globals.css            # Global styles
│   ├── components/
│   │   ├── MintForm.tsx           # Main mint UI (single + batch)
│   │   ├── ConnectButton.tsx      # Wallet connect button
│   │   ├── RecentMints.tsx        # Live mint feed
│   │   ├── SuccessModal.tsx       # Post-mint confirmation + share
│   │   ├── TokenSwap.tsx          # $X402ID swap panel (Base, via workers/swap)
│   │   └── WalletConnectErrorBoundary.tsx
│   └── lib/
│       ├── wagmi.ts               # wagmi config + connectors
│       ├── contracts.ts           # Contract addresses + ABI
│       ├── token.ts               # $X402ID constants + swap API URL
│       └── parents.ts             # Parent node configs (namehashes)
├── workers/
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

---

## Parent Name Renewals

A subname's expiry is capped at its parent's, so the parents are the one thing that must be kept alive. Current expiries (read live on the site from the NameWrapper):

| Parent | Expiry |
|--------|--------|
| `402bot.eth` | May 2029 |
| `402api.eth` | May 2028 |
| `402mcp.eth` | May 2028 |

Parents are renewed from **$X402ID trading fees**, which accrue in WETH to the x402 treasury Safe. Renewals are the first call on that treasury, ahead of development and buybacks. After each renewal, `scripts/extend-subname-expiry.mjs` extends every existing subname to match — holders never pay or act.

---

## $X402ID Token

| | |
|---|---|
| Token | [`0xb9490fc272642A7De0539FB3dC52A2769936FBa3`](https://basescan.org/token/0xb9490fc272642A7De0539FB3dC52A2769936FBa3) on Base, launched 2026-09-26 via Bankr |
| Supply | 100,000,000,000, fixed |
| Liquidity | 85% in a Uniswap v4 pool paired with WETH |
| Treasury | 15% vesting over 1 year (30-day cliff) to the x402 Safe [`0x8E61…631C`](https://app.safe.global/home?safe=base:0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C) (2-of-3) |
| Trading fees | 0.665% of volume to the Safe in WETH |
| Mint cashback | 25% of the mint fee back in $X402ID for every name registered since launch; claimable on Base in monthly rounds from 2026-10-26 |

The site's swap panel quotes through `workers/swap/`, a Cloudflare Worker that holds the 0x API key and pins every quote to ETH ↔ X402ID on Base with a 0.10% fee to the Safe.

$X402ID is a utility token. It is not an investment and carries no claim on revenue.

---

## Contact

📧 [x402id@onchain-id.id](mailto:x402id@onchain-id.id)

---

## License

MIT
