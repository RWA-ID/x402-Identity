"use client";

import { useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { mainnet } from "wagmi/chains";
import { parseEther } from "viem";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export function useBatchRegister() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, reset, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId: mainnet.id });

  const batchRegister = async (rows: { parentNode: `0x${string}`; label: string }[]) => {
    // The registrar is mainnet-only; a wallet left on Base (e.g. after a swap) must switch first.
    if (chainId !== mainnet.id) {
      try {
        await switchChainAsync({ chainId: mainnet.id });
      } catch {
        return;
      }
    }
    const parentNodes = rows.map((r) => r.parentNode);
    const labels = rows.map((r) => r.label);
    const totalFee = parseEther("0.005") * BigInt(rows.length);
    writeContract({
      chainId: mainnet.id,
      address: ADDRESSES.mainnet.registrar,
      abi: REGISTRAR_ABI,
      functionName: "batchRegister",
      args: [parentNodes, labels],
      value: totalFee,
    });
  };

  return { batchRegister, reset, hash, isPending, isConfirming, isSuccess, error };
}
