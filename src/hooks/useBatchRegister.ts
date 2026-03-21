"use client";

import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseEther } from "viem";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export function useBatchRegister() {
  const chainId = useChainId();
  const addr = chainId === 1 ? ADDRESSES.mainnet.registrar : ADDRESSES.sepolia.registrar;
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const batchRegister = (rows: { parentNode: `0x${string}`; label: string }[]) => {
    const parentNodes = rows.map((r) => r.parentNode);
    const labels = rows.map((r) => r.label);
    const totalFee = parseEther("0.005") * BigInt(rows.length);
    writeContract({
      address: addr,
      abi: REGISTRAR_ABI,
      functionName: "batchRegister",
      args: [parentNodes, labels],
      value: totalFee,
    });
  };

  return { batchRegister, hash, isPending, isConfirming, isSuccess, error };
}
