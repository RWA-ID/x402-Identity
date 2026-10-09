"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { namehash } from "viem";
import {
  buildPayeeCalls,
  getLowFees,
  groupByResolver,
  publicResolverAbi,
  type PayeePlan,
} from "@x402identity/widget-core";
import { writeChainId } from "@/lib/embedded";

export type WritePayeeState = "idle" | "signing" | "confirming" | "written" | "failed";

/**
 * Write the payee-name records for several names: one resolver multicall per
 * resolver, which is one signature when the names were all minted here. The
 * wallet must own every name.
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
      const byName = new Map(plans.map((p) => [p.name, p.plan]));
      const [groups, fees] = await Promise.all([groupByResolver(client, [...byName.keys()]), getLowFees(client)]);
      for (const [resolver, names] of groups) {
        setState("signing");
        const hash = await writeContractAsync({
          ...fees,
          chainId: writeChainId(connector, mainnet.id),
          address: resolver,
          abi: publicResolverAbi,
          functionName: "multicall",
          args: [names.flatMap((n) => buildPayeeCalls(namehash(n), byName.get(n)!))],
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
