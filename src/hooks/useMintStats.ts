"use client";

import { useEffect, useState } from "react";
import { useChainId, usePublicClient, useWatchContractEvent } from "wagmi";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export type LastMint = {
  parentNode: `0x${string}`;
  label: string;
  minter: `0x${string}`;
  blockNumber: bigint;
  timestamp: number | null;
};

export function useMintStats() {
  const chainId = useChainId();
  const client = usePublicClient();
  const addr = chainId === 1 ? ADDRESSES.mainnet.registrar : ADDRESSES.sepolia.registrar;

  const [total, setTotal] = useState<number | null>(null);
  const [last, setLast] = useState<LastMint | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!client) return;

    (async () => {
      try {
        const logs = await client.getContractEvents({
          address: addr,
          abi: REGISTRAR_ABI,
          eventName: "SubnameMinted",
          fromBlock: "earliest",
          toBlock: "latest",
        });
        if (cancelled) return;
        setTotal(logs.length);

        const newest = logs[logs.length - 1];
        if (newest) {
          let timestamp: number | null = null;
          try {
            const block = await client.getBlock({ blockNumber: newest.blockNumber });
            timestamp = Number(block.timestamp) * 1000;
          } catch {
            // ignore
          }
          if (cancelled) return;
          setLast({
            parentNode: newest.args.parentNode as `0x${string}`,
            label: newest.args.label as string,
            minter: newest.args.minter as `0x${string}`,
            blockNumber: newest.blockNumber,
            timestamp,
          });
        }
      } catch {
        // RPC failed — leave nulls so UI shows placeholders
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, addr]);

  useWatchContractEvent({
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
