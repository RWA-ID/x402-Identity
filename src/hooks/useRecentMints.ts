"use client";

import { useWatchContractEvent } from "wagmi";
import { mainnet } from "wagmi/chains";
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
  const [mints, setMints] = useState<MintEvent[]>([]);

  useWatchContractEvent({
    chainId: mainnet.id,
    address: ADDRESSES.mainnet.registrar,
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
