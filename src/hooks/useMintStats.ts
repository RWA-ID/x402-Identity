"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { mainnet } from "wagmi/chains";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export type LastMint = {
  parentNode: `0x${string}`;
  label: string;
  minter: `0x${string}`;
  blockNumber: bigint;
  timestamp: number | null;
};

export function useMintStats() {
  // Registrar lives on mainnet only — never follow the wallet's chain.
  const chainId = mainnet.id;
  const addr = ADDRESSES.mainnet.registrar;
  const client = usePublicClient({ chainId });

  const [total, setTotal] = useState<number | null>(null);
  const [last, setLast] = useState<LastMint | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    (async () => {
      try {
        // Every mint since the registrar was deployed, in one request: the site key
        // is on a paid Alchemy plan, which has no block-range cap on eth_getLogs.
        const logs = await client.getContractEvents({
          address: addr,
          abi: REGISTRAR_ABI,
          eventName: "SubnameMinted",
          fromBlock: 0n,
          toBlock: "latest",
        });
        if (cancelled) return;
        setTotal(logs.length);

        const newest = logs[logs.length - 1];
        if (!newest) return;
        const block = await client.getBlock({ blockNumber: newest.blockNumber });
        if (cancelled) return;
        setLast({
          parentNode: newest.args.parentNode as `0x${string}`,
          label: newest.args.label as string,
          minter: newest.args.minter as `0x${string}`,
          blockNumber: newest.blockNumber,
          timestamp: Number(block.timestamp) * 1000,
        });
      } catch {
        // network failure — leave nulls so UI shows placeholder
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, addr]);

  useWatchContractEvent({
    chainId,
    address: addr,
    abi: REGISTRAR_ABI,
    eventName: "SubnameMinted",
    onLogs(logs) {
      if (logs.length === 0) return;
      setTotal((prev) => (prev ?? 0) + logs.length);
      const newest = logs[logs.length - 1];
      setLast({
        parentNode: newest.args.parentNode as `0x${string}`,
        label: newest.args.label as string,
        minter: newest.args.minter as `0x${string}`,
        blockNumber: newest.blockNumber,
        timestamp: Date.now(),
      });
    },
  });

  return { total, last };
}
