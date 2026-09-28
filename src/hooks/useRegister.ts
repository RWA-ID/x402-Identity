"use client";

import { useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useFreshMintFee } from "@/hooks/useMintFee";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export function useRegister() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, reset, data: hash, isPending, error: writeError } = useWriteContract();

  const readMintFee = useFreshMintFee();

  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash, chainId: mainnet.id });
  // A mined receipt is not a successful one — a reverted mint must not show the success panel.
  const isSuccess = receipt?.status === "success";
  const error = writeError ?? (receipt?.status === "reverted" ? new Error("Transaction reverted") : null);

  const register = async (parentNode: `0x${string}`, label: string) => {
    // The registrar is mainnet-only; a wallet left on Base (e.g. after a swap) must switch first.
    if (chainId !== mainnet.id) {
      try {
        await switchChainAsync({ chainId: mainnet.id });
      } catch {
        return;
      }
    }
    let fee: bigint;
    try {
      fee = await readMintFee();
    } catch {
      return;
    }
    writeContract({
      chainId: mainnet.id,
      address: ADDRESSES.mainnet.registrar,
      abi: REGISTRAR_ABI,
      functionName: "register",
      args: [parentNode, label],
      value: fee,
    });
  };

  return { register, reset, hash, isPending, isConfirming, isSuccess, error };
}
