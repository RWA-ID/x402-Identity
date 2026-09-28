"use client";

import { useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";

// Chainlink ETH / USD proxy on mainnet (8 decimals). Verified: description() = "ETH / USD".
const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as const;
const FEED_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

// The feed's heartbeat is 1h; anything much older is a stalled feed, not a price.
const MAX_AGE_S = 3 * 60 * 60;

/** Formats a wei amount as "≈ $4.00", or null while the price is unknown or stale. */
export function useEthUsd() {
  const { data } = useReadContract({
    chainId: mainnet.id,
    address: ETH_USD_FEED,
    abi: FEED_ABI,
    functionName: "latestRoundData",
    query: { staleTime: 5 * 60_000 },
  });

  const answer = data?.[1];
  const updatedAt = data?.[3];
  const fresh =
    answer !== undefined &&
    answer > 0n &&
    updatedAt !== undefined &&
    Date.now() / 1000 - Number(updatedAt) < MAX_AGE_S;

  return (wei: bigint): string | null => {
    if (!fresh) return null;
    // wei (1e18) × price (1e8) → cents: divide by 1e24.
    const cents = Number((wei * (answer as bigint)) / 10n ** 24n);
    return `≈ $${(cents / 100).toFixed(2)}`;
  };
}
