import { getAddress, isAddress } from "viem";
import { SOLANA_MAINNET, solanaKeyBytes } from "@x402identity/widget-core";

/** CAIP-2 id of Lightning mainnet; Solana's comes from widget-core with its decoder. */
export { SOLANA_MAINNET };
export const LIGHTNING_MAINNET = "lnbtc:000000000019d6689c085ae165831e93";

/**
 * The payout account as it must be written for `network`, or null when it is
 * not a valid account there. The verifier compares non-EVM accounts exactly,
 * so this is also the canonical form:
 * - EVM: checksummed.
 * - Solana: a 32-byte base58 public key, case-sensitive.
 * - Lightning: the receiver node's compressed secp256k1 key, 66 lowercase hex
 *   characters (x402 `exact` on lnbtc). It is not an on-chain Bitcoin address.
 */
export function normalizePayTo(network: string, payTo: string): string | null {
  const v = payTo.trim();
  if (network.startsWith("eip155:")) return isAddress(v, { strict: false }) ? getAddress(v) : null;
  if (network === SOLANA_MAINNET) return solanaKeyBytes(v) ? v : null;
  if (network === LIGHTNING_MAINNET) {
    const hex = v.toLowerCase();
    return /^0[23][0-9a-f]{64}$/.test(hex) ? hex : null;
  }
  return null;
}

/** Placeholder text for a payout field on `network`. */
export function payToPlaceholder(network: string): string {
  if (network === SOLANA_MAINNET) return "Solana payout address";
  if (network === LIGHTNING_MAINNET) return "Lightning node key (02… or 03…, 66 hex)";
  return "0x… payout address";
}
