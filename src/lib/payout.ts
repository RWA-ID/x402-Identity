import { encodeFunctionData, getAddress, type Address, type Hex, type PublicClient } from "viem";
import { toCoinType } from "viem/ens";
import { publicResolverAbi, solanaKeyBytes, SOLANA_COIN_TYPE } from "@x402identity/widget-core";

/** ENSIP-19 default EVM coin type: the address for every EVM chain without its own record. */
export const DEFAULT_EVM_COIN_TYPE = 0x80000000n;

/** Always written: the records wallets read most. */
export const BASE_CHAINS = [
  { id: 1, label: "Ethereum" },
  { id: 8453, label: "Base" },
] as const;

/** Optional chains, ordered by how many x402 sellers accept them (Bazaar, 2026-10-23). */
export const EXTRA_CHAINS = [
  { id: 137, label: "Polygon" },
  { id: 42161, label: "Arbitrum" },
  { id: 480, label: "World Chain" },
  { id: 143, label: "Monad" },
  { id: 196, label: "X Layer" },
  { id: 56, label: "BNB Chain" },
  { id: 999, label: "HyperEVM" },
  { id: 4663, label: "Robinhood Chain" },
  { id: 43114, label: "Avalanche" },
  { id: 10, label: "Optimism" },
] as const;

export type Payout = {
  /** Chain ids from EXTRA_CHAINS to write explicitly. */
  chains: number[];
  /** Also set the default EVM address. Only offered for an externally owned account. */
  defaultEvm: boolean;
  /** Solana payout address (base58), or "" for none. */
  solana: string;
};

export const emptyPayout = (): Payout => ({ chains: [], defaultEvm: false, solana: "" });

/** True when `payout.solana` is empty or a valid Solana public key. */
export function solanaOk(payout: Payout): boolean {
  return payout.solana.trim() === "" || solanaKeyBytes(payout.solana.trim()) !== null;
}

/** Labels of every chain the records will name, for the confirmation text. */
export function payoutLabels(payout: Payout): string[] {
  return [
    ...BASE_CHAINS.map((c) => c.label),
    ...EXTRA_CHAINS.filter((c) => payout.chains.includes(c.id)).map((c) => c.label),
    ...(payout.defaultEvm ? ["every other EVM chain"] : []),
    ...(payout.solana.trim() ? ["Solana"] : []),
  ];
}

/**
 * Resolver calls that point one name at the wallet: Ethereum and Base always,
 * the chosen extra chains, the default EVM address if chosen, and a Solana
 * address record (coin type 501) if one was entered.
 */
export function buildPayoutCalls(node: Hex, evm: Address, payout: Payout): Hex[] {
  const a = getAddress(evm);
  const set = (coinType: bigint, value: Hex) =>
    encodeFunctionData({ abi: publicResolverAbi, functionName: "setAddr", args: [node, coinType, value] });
  const calls = [
    ...BASE_CHAINS.map((c) => set(toCoinType(c.id), a)),
    ...EXTRA_CHAINS.filter((c) => payout.chains.includes(c.id)).map((c) => set(toCoinType(c.id), a)),
  ];
  if (payout.defaultEvm) calls.push(set(DEFAULT_EVM_COIN_TYPE, a));
  const sol = payout.solana.trim() ? solanaKeyBytes(payout.solana.trim()) : null;
  if (sol) calls.push(set(SOLANA_COIN_TYPE, sol));
  return calls;
}

/** EIP-7702: an EOA delegated to code keeps its key, so it still counts as an EOA. */
const DELEGATION_PREFIX = "0xef0100";

/**
 * Whether `address` is an externally owned account on every given chain. A
 * contract wallet's address can belong to someone else on a chain where it
 * was never deployed, so the default EVM address is only offered for an EOA.
 * A failed read is "unknown", never "eoa".
 */
export async function walletKind(clients: PublicClient[], address: Address): Promise<"eoa" | "contract" | "unknown"> {
  try {
    const codes = await Promise.all(clients.map((c) => c.getCode({ address })));
    return codes.every((code) => !code || code === "0x" || code.toLowerCase().startsWith(DELEGATION_PREFIX))
      ? "eoa"
      : "contract";
  } catch {
    return "unknown";
  }
}
