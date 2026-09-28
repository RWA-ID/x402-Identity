"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { namehash } from "viem";
import { buildSetAddressCalls, getLowFees, getResolver, publicResolverAbi } from "@x402identity/widget-core";
import { writeChainId } from "@/lib/embedded";

export type SetAddressState = "idle" | "signing" | "confirming" | "linked" | "failed";

/**
 * Minting writes no address record, so a fresh name resolves to 0x0. This
 * points each name's ETH and Base records at the connected wallet in one
 * resolver multicall. The wallet must own every name.
 */
export function useSetAddress() {
  const { address, chainId, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient({ chainId: mainnet.id });
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<SetAddressState>("idle");
  const [error, setError] = useState<string | null>(null);

  const setAddress = async (names: string[]) => {
    if (!address || !client || names.length === 0) return;
    const nodes = names.map((n) => namehash(n));
    setError(null);
    setState("signing");
    try {
      if (chainId !== mainnet.id) await switchChainAsync({ chainId: mainnet.id });
      // Every name minted here shares the registrar's resolver; read it rather than assume.
      const [resolver, fees] = await Promise.all([getResolver(client, names[0]), getLowFees(client)]);
      const hash = await writeContractAsync({
        ...fees,
        chainId: writeChainId(connector, mainnet.id),
        address: resolver,
        abi: publicResolverAbi,
        functionName: "multicall",
        args: [nodes.flatMap((n) => buildSetAddressCalls(n, address))],
      });
      setState("confirming");
      // waitForTransactionReceipt resolves on a revert too — check the status.
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      setState("linked");
    } catch (e) {
      setError(errorMessage(e) ?? "Set address failed");
      setState("failed");
    }
  };

  const reset = () => {
    setState("idle");
    setError(null);
  };

  return { setAddress, reset, state, error, address };
}

function errorMessage(e: unknown): string | undefined {
  const err = e as { shortMessage?: string; message?: string } | null;
  return err?.shortMessage ?? err?.message;
}
