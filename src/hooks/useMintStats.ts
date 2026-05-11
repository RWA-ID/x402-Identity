"use client";

import { useEffect, useState } from "react";
import { useChainId, useWatchContractEvent } from "wagmi";
import { decodeAbiParameters, parseAbiParameters } from "viem";
import { ADDRESSES, REGISTRAR_ABI } from "@/lib/contracts";

export type LastMint = {
  parentNode: `0x${string}`;
  label: string;
  minter: `0x${string}`;
  blockNumber: bigint;
  timestamp: number | null;
};

const TOPIC0_SUBNAME_MINTED =
  "0x8fd05628e8c8091170a3b692a1bcb11cf2b13b6020e3ff27b62753bfaa419b0d";
const DATA_PARAMS = parseAbiParameters("string label, bytes32 subnameNode, uint256 fee");

const ETHERSCAN_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "";

type EtherscanLog = {
  address: string;
  topics: string[];
  data: `0x${string}`;
  blockNumber: string;
  timeStamp: string;
  transactionHash: string;
};

export function useMintStats() {
  const chainId = useChainId();
  const addr = chainId === 1 ? ADDRESSES.mainnet.registrar : ADDRESSES.sepolia.registrar;

  const [total, setTotal] = useState<number | null>(null);
  const [last, setLast] = useState<LastMint | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url =
          `https://api.etherscan.io/v2/api?chainid=${chainId}` +
          `&module=logs&action=getLogs` +
          `&address=${addr}&topic0=${TOPIC0_SUBNAME_MINTED}` +
          `&fromBlock=0&toBlock=latest` +
          (ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : "");

        const res = await fetch(url);
        const json = (await res.json()) as { status: string; message: string; result: EtherscanLog[] | string };
        if (cancelled) return;

        if (json.status !== "1" || !Array.isArray(json.result)) {
          // "No records found" comes back as status=0 with empty result — that means zero mints.
          if (typeof json.result !== "string" || json.message === "No records found") {
            setTotal(0);
          }
          return;
        }

        const logs = json.result;
        setTotal(logs.length);

        const newest = logs[logs.length - 1];
        if (newest) {
          try {
            const [label] = decodeAbiParameters(DATA_PARAMS, newest.data);
            setLast({
              parentNode: newest.topics[1] as `0x${string}`,
              label: label as string,
              minter: (`0x${newest.topics[2].slice(-40)}`) as `0x${string}`,
              blockNumber: BigInt(parseInt(newest.blockNumber, 16)),
              timestamp: parseInt(newest.timeStamp, 16) * 1000,
            });
          } catch {
            // decode failure — leave last as null
          }
        }
      } catch {
        // network failure — leave nulls so UI shows placeholder
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chainId, addr]);

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
