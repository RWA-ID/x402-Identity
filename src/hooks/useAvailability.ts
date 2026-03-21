"use client";

import { useReadContract, useChainId } from "wagmi";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export function useAvailability(parentNode: `0x${string}`, label: string) {
  const chainId = useChainId();
  const addr = chainId === 1 ? ADDRESSES.mainnet.registrar : ADDRESSES.sepolia.registrar;

  return useReadContract({
    address: addr,
    abi: REGISTRAR_ABI,
    functionName: "isAvailable",
    args: [parentNode, label],
    query: {
      enabled: label.length >= 3,
      refetchInterval: 5_000,
    },
  });
}
