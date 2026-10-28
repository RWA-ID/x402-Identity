"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { getLowFees, payeeWrites, publicResolverAbi, type PayeePlan } from "@x402identity/widget-core";
import { writeChainId } from "@/lib/embedded";

export type WritePayeeState = "idle" | "signing" | "confirming" | "written" | "failed";

/**
 * Write the payee-name records for several names: one resolver multicall per
 * resolver, which is one signature when the names were all minted here. Each
 * name's calls take the form its ENS version needs. The wallet must control
 * every name.
 */
export function useWritePayee() {
  const { chainId, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient({ chainId: mainnet.id });
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<WritePayeeState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hashes, setHashes] = useState<`0x${string}`[]>([]);

  const write = async (plans: { name: string; plan: PayeePlan }[]) => {
    if (!client || plans.length === 0) return;
    setError(null);
    setHashes([]);
    setState("signing");
    try {
      if (chainId !== mainnet.id) await switchChainAsync({ chainId: mainnet.id });
      const [writes, fees] = await Promise.all([payeeWrites(client, plans), getLowFees(client)]);
      for (const w of writes) {
        setState("signing");
        const hash = await writeContractAsync({
          ...fees,
          chainId: writeChainId(connector, mainnet.id),
          address: w.resolver,
          abi: publicResolverAbi,
          functionName: "multicall",
          args: [w.calls],
        });
        setHashes((h) => [...h, hash]);
        setState("confirming");
        // waitForTransactionReceipt resolves on a revert too — check the status.
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Transaction reverted");
      }
      setState("written");
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err?.shortMessage ?? err?.message ?? "Writing records failed");
      setState("failed");
    }
  };

  const reset = () => {
    setState("idle");
    setError(null);
    setHashes([]);
  };

  return { write, reset, state, error, hashes };
}
