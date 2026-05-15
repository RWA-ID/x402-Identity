# x402 Identity Hub

**Permanent ENS subname registration for AI agents — fully onchain on Ethereum.**

Mint subnames under `402bot.eth`, `402api.eth`, or `402mcp.eth` for 0.005 ETH each. No renewals, no expiry, no middlemen. The name is yours forever.

🌐 **Live:** [x402id.eth.link](https://x402id.eth.link)
🐦 **Twitter/X:** [@x402identity](https://twitter.com/x402identity)

---

## Overview

x402 Identity Hub gives AI agents a verifiable onchain identity through the ENS (Ethereum Name Service) infrastructure. Each minted subname is a permanent ENS record stored in the NameWrapper contract — transferable, resolvable, and composable with the broader ENS ecosystem.

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
| `X402SubnameRegistrar` | [`0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633`](https://etherscan.io/address/0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633) | Mints permanent ENS subnames under the supported parents |
| `X402RegistrarForwarder` | [`0x05af104ce913e7ef39799bfada871817d3761778`](https://etherscan.io/address/0x05af104ce913e7ef39799bfada871817d3761778) | Splits payment between protocol and a third-party platform's treasury in a single tx |

The registrar interacts directly with the ENS **NameWrapper** contract to issue permanent subnames. Key functions:

| Function | Description |
|----------|-------------|
| `register(node, label)` | Mint a single subname |
| `batchRegister(nodes[], labels[])` | Mint multiple subnames in one tx |
| `isAvailable(node, label)` | Check if a subname is available |
| `withdrawFees()` | Owner: withdraw accumulated ETH |

**Mint fee:** 0.005 ETH per name (protocol fee)  
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
npm install @x402id/widget-react viem
```

```tsx
import { X402Widget } from "@x402id/widget-react";
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

### Widget repo layout

| Path | What it is |
|------|------------|
| `contracts/X402RegistrarForwarder.sol` | Payment-splitting forwarder, ERC1155-receiver, owner-tunable fee cap |
| `packages/widget-core/` | Framework-agnostic viem helpers (ABIs, validation, tx builders) |
| `packages/widget-react/` | `<X402Widget>` component with fallback connect UI, zero-dep styling |
| `public/embed.js` | Vanilla script-tag loader for non-React sites |
| `src/app/widget/` | Standalone widget page (iframe target for `embed.js`) |
| `src/app/integrate/` | Public integrator-facing docs page |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.20 · OpenZeppelin v5 · Hardhat |
| Frontend | Next.js 14 · React 18 · TypeScript |
| Web3 | wagmi v2 · viem v2 · WalletConnect |
| Styling | Tailwind CSS · Framer Motion |
| Hosting | IPFS (Pinata) · ENS contenthash |

---

## Hosting

The frontend is a static export (`next build` → `out/`) pinned to IPFS and served via the `x402id.eth` ENS contenthash. No centralized server required.

**IPFS CID:** `bafybeigrr7skyhxmkrjpop3sr76xy5ut4mjmxzl4ngob6xqs4llkresliy`

```
https://ipfs.io/ipfs/bafybeigrr7skyhxmkrjpop3sr76xy5ut4mjmxzl4ngob6xqs4llkresliy/
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
│   └── X402SubnameRegistrar.sol   # Core registrar contract
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
│   │   └── WalletConnectErrorBoundary.tsx
│   └── lib/
│       ├── wagmi.ts               # wagmi config + connectors
│       ├── contracts.ts           # Contract addresses + ABI
│       └── parents.ts             # Parent node configs (namehashes)
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

## Parent Name Longevity Commitment

Starting **June 1, 2026**, the expiry of each parent name (`402bot.eth`, `402api.eth`, `402mcp.eth`) will be extended by **10 years every month for the next 10 years** — adding 120 years of coverage per year, for a cumulative total of **1,200 years** at the end of the 10-year program.

This ensures that every subname minted today remains permanently resolvable on ENS for generations, with no risk of parent name expiry affecting your agent's identity.

---

## Contact

📧 [x402id@onchain-id.id](mailto:x402id@onchain-id.id)

---

## License

MIT
