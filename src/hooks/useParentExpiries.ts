"use client";

import { useReadContracts } from "wagmi";
import { mainnet } from "wagmi/chains";
import { PARENTS } from "@/lib/parents";
import { ADDRESSES } from "@/lib/contracts";

const GET_DATA_ABI = [
  {
    name: "getData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
  },
] as const;

/** Live NameWrapper expiry of each parent. Subnames are capped at their parent's expiry. */
export function useParentExpiries() {
  const { data } = useReadContracts({
    contracts: PARENTS.map((p) => ({
      chainId: mainnet.id,
      address: ADDRESSES.mainnet.nameWrapper,
      abi: GET_DATA_ABI,
      functionName: "getData" as const,
      args: [BigInt(p.node)] as const,
    })),
  });

  const parents = PARENTS.map((p, i) => {
    const r = data?.[i];
    const expiry = r?.status === "success" && r.result[2] > 0n ? new Date(Number(r.result[2]) * 1000) : null;
    return { label: p.label, expiry };
  });
  const known = parents.map((p) => p.expiry).filter((d): d is Date => d !== null);
  const earliest = known.length === PARENTS.length ? new Date(Math.min(...known.map((d) => d.getTime()))) : null;

  return { parents, earliest };
}

export function fmtMonthYear(d: Date | null) {
  return d ? d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "—";
}
