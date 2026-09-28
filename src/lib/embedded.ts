import type { Connector } from "wagmi";

/** The wallet AppKit mints for an email or social login (connector id/type "AUTH"). */
export function isEmbeddedWallet(connector: Connector | undefined): boolean {
  return connector?.id === "AUTH" || connector?.type === "AUTH";
}

/**
 * The `chainId` to hand a wagmi write — undefined for the embedded wallet.
 *
 * The embedded wallet answers `eth_chainId` with the CAIP-2 string "eip155:1",
 * and viem's chain assertion runs `BigInt()` on it and throws before the wallet
 * ever prompts (reown-com/appkit#5764). wagmi passes `chain: null` when no
 * chainId is given, which skips that assertion. Callers switch chains first, so
 * nothing is lost; never do this for injected wallets, which can be on any chain.
 */
export function writeChainId<T extends number>(connector: Connector | undefined, chainId: T): T | undefined {
  return isEmbeddedWallet(connector) ? undefined : chainId;
}
