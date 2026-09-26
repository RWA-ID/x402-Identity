"use client";

import { useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { mainnet } from "wagmi/chains";
import { parseEther } from "viem";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export function useRegister() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, reset, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId: mainnet.id });

  const register = async (parentNode: `0x${string}`, label: string) => {
    // The registrar is mainnet-only; a wallet left on Base (e.g. after a swap) must switch first.
    if (chainId !== mainnet.id) {
      try {
        await switchChainAsync({ chainId: mainnet.id });
      } catch {
        return;
      }
    }
    writeContract({
      chainId: mainnet.id,
      address: ADDRESSES.mainnet.registrar,
      abi: REGISTRAR_ABI,
      functionName: "register",
      args: [parentNode, label],
      value: parseEther("0.005"),
    });
  };

  return { register, reset, hash, isPending, isConfirming, isSuccess, error };
}
