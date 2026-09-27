"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import type { Hex } from "viem";
import { buildSetAddressCalls, getLowFees, getResolver, publicResolverAbi } from "@x402identity/widget-core";

export type SetAddressState = "idle" | "signing" | "confirming" | "linked" | "failed";

/**
 * Minting writes no address record, so a fresh name resolves to 0x0. This
 * points each name's ETH and ENSIP-19 default-EVM (Base, any EVM chain)
 * records at the connected wallet in one resolver multicall. The wallet must
 * own every name.
 */
export function useSetAddress() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient({ chainId: mainnet.id });
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<SetAddressState>("idle");
  const [error, setError] = useState<string | null>(null);

  const setAddress = async (nodes: Hex[]) => {
    if (!address || !client || nodes.length === 0) return;
    setError(null);
    setState("signing");
    try {
      if (chainId !== mainnet.id) await switchChainAsync({ chainId: mainnet.id });
      // Every name minted here shares the registrar's resolver; read it rather than assume.
      const [resolver, fees] = await Promise.all([getResolver(client, nodes[0]), getLowFees(client)]);
      const hash = await writeContractAsync({
        ...fees,
        chainId: mainnet.id,
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
