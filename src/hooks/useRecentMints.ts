"use client";

import { useWatchContractEvent, useChainId } from "wagmi";
import { useState } from "react";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export type MintEvent = {
  parentNode: `0x${string}`;
  label: string;
  subnameNode: `0x${string}`;
  minter: `0x${string}`;
  fee: bigint;
  timestamp: number;
};

export function useRecentMints() {
  const chainId = useChainId();
  const addr = chainId === 1 ? ADDRESSES.mainnet.registrar : ADDRESSES.sepolia.registrar;
  const [mints, setMints] = useState<MintEvent[]>([]);

  useWatchContractEvent({
    address: addr,
    abi: REGISTRAR_ABI,
    eventName: "SubnameMinted",
    onLogs(logs) {
      const newMints = logs.map((log) => ({
        parentNode: log.args.parentNode as `0x${string}`,
        label: log.args.label as string,
        subnameNode: log.args.subnameNode as `0x${string}`,
        minter: log.args.minter as `0x${string}`,
        fee: log.args.fee as bigint,
        timestamp: Date.now(),
      }));
      setMints((prev) => [...newMints, ...prev].slice(0, 20));
    },
  });

  return mints;
}
