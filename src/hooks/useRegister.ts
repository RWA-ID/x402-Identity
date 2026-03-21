"use client";

import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseEther } from "viem";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export function useRegister() {
  const chainId = useChainId();
  const addr = chainId === 1 ? ADDRESSES.mainnet.registrar : ADDRESSES.sepolia.registrar;
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = (parentNode: `0x${string}`, label: string) => {
    writeContract({
      address: addr,
      abi: REGISTRAR_ABI,
      functionName: "register",
      args: [parentNode, label],
      value: parseEther("0.005"),
    });
  };

  return { register, hash, isPending, isConfirming, isSuccess, error };
}
