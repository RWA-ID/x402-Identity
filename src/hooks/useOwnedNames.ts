"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { mainnet } from "wagmi/chains";
import { decodeAbiParameters, getAddress, namehash, parseAbiParameters, type Address } from "viem";
import { ADDRESSES } from "@/lib/contracts";

const TOPIC0_SUBNAME_MINTED = "0x8fd05628e8c8091170a3b692a1bcb11cf2b13b6020e3ff27b62753bfaa419b0d";
const DATA_PARAMS = parseAbiParameters("string label, bytes32 subnameNode, uint256 fee");
const ETHERSCAN_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "";

// Both registrars mint under the same parents; the old one is still where the
// first names came from.
const REGISTRARS: Address[] = [ADDRESSES.mainnet.registrar, "0x0a9b0d20e9193dc5479ab98154124f4e2f569444"];
const PARENTS = ["402bot.eth", "402api.eth", "402mcp.eth"];
const PARENT_BY_NODE = new Map(PARENTS.map((p) => [namehash(p), p]));

const ownerOfAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

type EtherscanLog = { topics: string[]; data: `0x${string}` };

async function mintedNames(): Promise<string[]> {
  const names = new Set<string>();
  for (const registrar of REGISTRARS) {
    const url =
      `https://api.etherscan.io/v2/api?chainid=1&module=logs&action=getLogs` +
      `&address=${registrar}&topic0=${TOPIC0_SUBNAME_MINTED}&fromBlock=0&toBlock=latest` +
      (ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : "");
    const json = (await (await fetch(url)).json()) as { status: string; message: string; result: EtherscanLog[] | string };
    if (json.status !== "1" || !Array.isArray(json.result)) {
      // "No records found" is an empty registrar, not a failure.
      if (json.message === "No records found") continue;
      throw new Error(typeof json.result === "string" ? json.result : "Could not list minted names");
    }
    for (const log of json.result) {
      const parent = PARENT_BY_NODE.get(log.topics[1] as `0x${string}`);
      if (!parent) continue;
      try {
        const [label] = decodeAbiParameters(DATA_PARAMS, log.data);
        names.add(`${label}.${parent}`);
      } catch {
        // an undecodable log is skipped; the manual add covers that name
      }
    }
  }
  return [...names];
}

export type OwnedNamesState =
  | { status: "idle" | "loading" }
  | { status: "ready"; names: string[] }
  | { status: "failed"; error: string };

/**
 * x402 names the wallet holds now. Minting events give the candidates; the
 * NameWrapper owner decides, so a name that was transferred in (or is held by
 * a Safe) is found and one transferred out is not.
 */
export function useOwnedNames(owner: Address | undefined) {
  const client = usePublicClient({ chainId: mainnet.id });
  const [state, setState] = useState<OwnedNamesState>({ status: "idle" });

  useEffect(() => {
    if (!owner || !client) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const candidates = await mintedNames();
        const owners = await client.multicall({
          allowFailure: false,
          contracts: candidates.map((n) => ({
            address: ADDRESSES.mainnet.nameWrapper,
            abi: ownerOfAbi,
            functionName: "ownerOf" as const,
            args: [BigInt(namehash(n))] as const,
          })),
        });
        const me = getAddress(owner);
        const names = candidates.filter((_, i) => getAddress(owners[i]) === me).sort();
        if (!cancelled) setState({ status: "ready", names });
      } catch (e) {
        if (!cancelled) setState({ status: "failed", error: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, client]);

  return state;
}

/** Whether `owner` holds `name` on the NameWrapper. Throws on a failed read. */
export async function holdsName(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  name: string,
  owner: Address,
): Promise<boolean> {
  const holder = await client.readContract({
    address: ADDRESSES.mainnet.nameWrapper,
    abi: ownerOfAbi,
    functionName: "ownerOf",
    args: [BigInt(namehash(name))],
  });
  return getAddress(holder) === getAddress(owner);
}
