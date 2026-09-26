import { type Address } from "viem";

// $X402ID — launched on Base via Bankr (Doppler / Uniswap v4), 2026-09-26.
export const TOKEN = {
  address: "0xb9490fc272642A7De0539FB3dC52A2769936FBa3" as Address,
  symbol: "X402ID",
  name: "x402 Identity",
  decimals: 18,
  chainId: 8453,
  totalSupply: "100,000,000,000",
  poolId: "0x49369bb5411ef56cdf8469bc532be5aae84cb2a24df83e38cbe411185eee1c5c",
  treasury: "0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C" as Address, // Safe, 2-of-3
  launchDate: "2026-09-26",
  cliffDate: "2026-10-26",
  cashbackPct: 25,
  swapFeePct: "0.10%",
} as const;

// Cloudflare Worker proxying the 0x Swap API; holds the key and pins the pair + fee.
export const SWAP_API =
  process.env.NEXT_PUBLIC_SWAP_API || "https://x402id-swap.dmpay.workers.dev";

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
