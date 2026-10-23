import { getAddress, isAddress } from "viem";

/** CAIP-2 ids for the non-EVM networks a payout address can be entered for by hand. */
export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const LIGHTNING_MAINNET = "lnbtc:000000000019d6689c085ae165831e93";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Byte length of a base58 string, or null when it isn't base58. */
function base58Length(s: string): number | null {
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let bytes = 0;
  for (; n > 0n; n >>= 8n) bytes++;
  for (const ch of s) {
    if (ch !== "1") break;
    bytes++; // each leading "1" is a leading zero byte
  }
  return bytes;
}

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
  if (network === SOLANA_MAINNET) return base58Length(v) === 32 ? v : null;
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
