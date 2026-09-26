"use client";

import { useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export function useAvailability(parentNode: `0x${string}`, label: string) {

  return useReadContract({
    chainId: mainnet.id,
    address: ADDRESSES.mainnet.registrar,
    abi: REGISTRAR_ABI,
    functionName: "isAvailable",
    args: [parentNode, label],
    query: {
      enabled: label.length >= 3,
      refetchInterval: 5_000,
    },
  });
}
