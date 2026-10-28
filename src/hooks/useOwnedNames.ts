"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { mainnet } from "wagmi/chains";
import { getAddress, namehash, type Address } from "viem";
import { ADDRESSES } from "@/lib/contracts";
import { SITE_NFT_API } from "@/lib/alchemy";

const PARENTS = ["402bot.eth", "402api.eth", "402mcp.eth"];
/** How long a wallet's list is reused, so leaving the page and coming back costs no call. */
const CACHE_MS = 60_000;

const ownerOfAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

type OwnedNft = { tokenId: string; name: string | null };
type OwnedNftsPage = { ownedNfts?: { tokenId: string; name?: string | null }[]; pageKey?: string };

/** One Alchemy NFT API call, retried once after a short wait if it is throttled. */
async function fetchJson(url: string): Promise<OwnedNftsPage> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Name lookup failed (HTTP ${res.status})`);
    return res.json();
  }
}

/** NameWrapper tokens the NFT index lists for `owner`, every page. */
async function wrappedTokens(owner: Address): Promise<OwnedNft[]> {
  if (!SITE_NFT_API) throw new Error("Name lookup isn't configured");
  const out: OwnedNft[] = [];
  let pageKey: string | undefined;
  do {
    const q = new URLSearchParams({ owner, withMetadata: "true", pageSize: "100" });
    q.append("contractAddresses[]", ADDRESSES.mainnet.nameWrapper);
    if (pageKey) q.set("pageKey", pageKey);
    const json = await fetchJson(`${SITE_NFT_API}/getNFTsForOwner?${q}`);
    for (const n of json.ownedNfts ?? []) out.push({ tokenId: n.tokenId, name: n.name ?? null });
    pageKey = json.pageKey;
  } while (pageKey);
  return out;
}

/** A name the index has not labelled yet (a fresh mint), from ENS's metadata service. */
async function nameFromMetadata(tokenId: string): Promise<string | null> {
  try {
    const hex = "0x" + BigInt(tokenId).toString(16).padStart(64, "0");
    const res = await fetch(`https://metadata.ens.domains/mainnet/${ADDRESSES.mainnet.nameWrapper}/${hex}`);
    return res.ok ? ((await res.json()).name ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Candidate x402 names for `owner`: wrapped names the index lists under one of
 * the parents. A label is kept only if it hashes to its own token id, so a name
 * the index mislabels can't stand in for another.
 */
async function candidateNames(owner: Address): Promise<string[]> {
  const names: string[] = [];
  for (const t of await wrappedTokens(owner)) {
    const name = t.name || (await nameFromMetadata(t.tokenId));
    if (!name) continue;
    const parent = PARENTS.find((p) => name.endsWith(`.${p}`));
    if (!parent || name.slice(0, -parent.length - 1).includes(".")) continue;
    if (BigInt(namehash(name)) !== BigInt(t.tokenId)) continue;
    names.push(name);
  }
  return names;
}

function cached(owner: Address): string[] | null {
  try {
    const raw = sessionStorage.getItem(`x402id:owned:${owner}`);
    if (!raw) return null;
    const { at, names } = JSON.parse(raw) as { at: number; names: string[] };
    return Date.now() - at < CACHE_MS ? names : null;
  } catch {
    return null;
  }
}

function remember(owner: Address, names: string[]) {
  try {
    sessionStorage.setItem(`x402id:owned:${owner}`, JSON.stringify({ at: Date.now(), names }));
  } catch {
    // storage blocked: the next visit just looks the names up again
  }
}

export type OwnedNamesState =
  | { status: "idle" | "loading" }
  | { status: "ready"; names: string[] }
  | { status: "failed"; error: string };

/**
 * x402 names the wallet holds now. The NFT index gives the candidates; the
 * NameWrapper owner decides, because an index can lag a transfer. A name that
 * was transferred in (or is held by a Safe) is found and one transferred out is not.
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
    const me = getAddress(owner);
    const hit = cached(me);
    if (hit) {
      setState({ status: "ready", names: hit });
      return;
    }
    setState({ status: "loading" });
    (async () => {
      try {
        const candidates = await candidateNames(me);
        const owners = await client.multicall({
          allowFailure: false,
          contracts: candidates.map((n) => ({
            address: ADDRESSES.mainnet.nameWrapper,
            abi: ownerOfAbi,
            functionName: "ownerOf" as const,
            args: [BigInt(namehash(n))] as const,
          })),
        });
        const names = candidates.filter((_, i) => getAddress(owners[i]) === me).sort();
        remember(me, names);
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
