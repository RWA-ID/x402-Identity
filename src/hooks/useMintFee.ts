"use client";

import { usePublicClient, useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { formatEther } from "viem";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

// Shown only until the live read lands, or if it fails. Payments never use it.
export const MINT_FEE_FALLBACK = 1_500_000_000_000_000n; // 0.0015 ETH

/** The registrar's current `mintFee`, read from chain so copy never drifts from the contract. */
export function useMintFee() {
  const { data } = useReadContract({
    chainId: mainnet.id,
    address: ADDRESSES.mainnet.registrar,
    abi: REGISTRAR_ABI,
    functionName: "mintFee",
    query: { staleTime: 60_000 },
  });
  const feeWei = (data as bigint | undefined) ?? MINT_FEE_FALLBACK;
  return {
    feeWei,
    feeEth: formatEther(feeWei),
    /** Total for `n` names, e.g. "0.0045". */
    totalEth: (n: number) => formatEther(feeWei * BigInt(n)),
  };
}

/**
 * Reads `mintFee` fresh at submit time. A cached or fallback value could underpay
 * after an owner fee change, and the registrar reverts the whole mint on that.
 */
export function useFreshMintFee() {
  const client = usePublicClient({ chainId: mainnet.id });
  return async () => {
    if (!client) throw new Error("No mainnet client available");
    return (await client.readContract({
      address: ADDRESSES.mainnet.registrar,
      abi: REGISTRAR_ABI,
      functionName: "mintFee",
    })) as bigint;
  };
}
