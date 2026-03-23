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

## Smart Contract

**`X402SubnameRegistrar`** — deployed on Ethereum mainnet.

```
0x0a9b0d20e9193dc5479ab98154124f4e2f569444
```

The registrar interacts directly with the ENS **NameWrapper** contract to issue permanent subnames. Key functions:

| Function | Description |
|----------|-------------|
| `register(node, label, owner)` | Mint a single subname |
| `batchRegister(node, labels[], owner)` | Mint multiple subnames in one tx |
| `isAvailable(node, label)` | Check if a subname is available |
| `withdrawFees(token)` | Owner: withdraw accumulated ETH |

**Mint fee:** 0.005 ETH per name  
**Batch:** Up to 10 names per transaction

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

**IPFS CID:** `bafybeia2z2ke6hniysmpy56plqfvuwrrtpuj2z6mcpeccszaztbz5kwxp4`

```
https://ipfs.io/ipfs/bafybeia2z2ke6hniysmpy56plqfvuwrrtpuj2z6mcpeccszaztbz5kwxp4/
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
NEXT_PUBLIC_REGISTRAR_ADDRESS=0x0a9b0d20e9193dc5479ab98154124f4e2f569444
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

## License

MIT
