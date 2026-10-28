"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { mainnet } from "wagmi/chains";
import { getAddress, type Address } from "viem";
import { candidateNames, checkNames, NOT_CONTROLLED, RELEASED, type NameEntry } from "@/lib/names";

export { checkNames, type NameEntry };

/** How long a wallet's list is reused, so leaving the page and coming back costs no call. */
const CACHE_MS = 60_000;

function cached(owner: Address): NameEntry[] | null {
  try {
    const raw = sessionStorage.getItem(`x402id:owned:v1:${owner}`);
    if (!raw) return null;
    const { at, names } = JSON.parse(raw) as { at: number; names: NameEntry[] };
    return Date.now() - at < CACHE_MS ? names : null;
  } catch {
    return null;
  }
}

function remember(owner: Address, names: NameEntry[]) {
  try {
    sessionStorage.setItem(`x402id:owned:v1:${owner}`, JSON.stringify({ at: Date.now(), names }));
  } catch {
    // storage blocked: the next visit just looks the names up again
  }
}

export type OwnedNamesState =
  | { status: "idle" | "loading" }
  | { status: "ready"; names: NameEntry[] }
  | { status: "failed"; error: string };

/**
 * The wallet's .eth names, each marked usable or not. The NFT index gives the
 * candidates; chain reads decide, because an index can lag a transfer. A name
 * held by a Safe is found, and one transferred out is not.
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
        const entries = await checkNames(client, candidates, me);
        // Names that are no longer the wallet's (controlled elsewhere, or released
        // after expiry) are left out; the rest are shown, usable ones first, so a
        // blocked name says why instead of vanishing.
        const shown = entries
          .filter((e) => e.ok || (e.reason !== NOT_CONTROLLED && e.reason !== RELEASED))
          .sort((a, b) => Number(b.ok) - Number(a.ok) || a.name.localeCompare(b.name));
        remember(me, shown);
        if (!cancelled) setState({ status: "ready", names: shown });
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
