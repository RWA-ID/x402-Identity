import { type Address, type Hex, type PublicClient, getAddress, labelhash, toHex, zeroAddress } from "viem";
import { packetToBytes } from "viem/ens";

/**
 * ENSv2 (live on mainnet since 2026-10-27). A .eth second-level name registered
 * or migrated there is an ERC-1155 in the ETH registry, and its records sit on a
 * Permissioned Resolver, usually one per account:
 *
 *  - its setters take the DNS-encoded name, not a namehash;
 *  - its only read is resolve(name, data) (ENSIP-10); text()/addr() revert;
 *  - the resolver stays with the account that set it, not with the name, so a
 *    name that changed hands keeps its previous owner's resolver until the
 *    holder points it at their own.
 *
 * Every other name (unmigrated .eth names, their subnames) is still ENSv1.
 */

/** The ETH registry: every .eth label, v2 names as registered, v1 names as reserved. */
export const ENSV2_ETH_REGISTRY: Address = "0xf60aba43E1f7F3DAB1186Ff03B561401C9Df85E2";

/** getStatus results. */
export const ENSV2_STATUS = { available: 0, reserved: 1, registered: 2 } as const;

export const ensV2RegistryAbi = [
  {
    type: "function",
    name: "getStatus",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
  },
  {
    /** Raw, unmasked: still answers once the name has expired. */
    type: "function",
    name: "getExpiry",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ type: "uint64" }],
  },
  {
    /** The current token id. It changes whenever roles change: read it at use, never store it. */
    type: "function",
    name: "getTokenId",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    /** Zero for an expired name or a stale token id. */
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    /** Masked to zero once expired. */
    type: "function",
    name: "getResolver",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const permissionedResolverAbi = [
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAddress",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "coinType", type: "uint256" },
      { name: "addressBytes", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "resolve",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ type: "bytes" }],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ type: "bytes[]" }],
  },
] as const;

export type EnsVersion = "v1" | "v2";

/** DNS wire format of a name, as Permissioned Resolver setters take it. */
export function dnsEncode(name: string): Hex {
  return toHex(packetToBytes(name));
}

/** Only a second-level .eth can be a v2 name in the ETH registry. */
export const isEth2ld = (name: string) => name.endsWith(".eth") && name.split(".").length === 2;

/** "v2" for a .eth registered or migrated in ENSv2; every other name is ENSv1. */
export async function ensVersion(publicClient: PublicClient, name: string): Promise<EnsVersion> {
  if (!isEth2ld(name)) return "v1";
  const status = await publicClient.readContract({
    address: ENSV2_ETH_REGISTRY,
    abi: ensV2RegistryAbi,
    functionName: "getStatus",
    args: [BigInt(labelhash(name.slice(0, -4)))],
  });
  return Number(status) === ENSV2_STATUS.registered ? "v2" : "v1";
}

/** The resolver a v2 name points at in the ETH registry, or zero once it is expired or unset. */
export async function getV2Resolver(publicClient: PublicClient, name: string): Promise<Address> {
  const resolver = await publicClient.readContract({
    address: ENSV2_ETH_REGISTRY,
    abi: ensV2RegistryAbi,
    functionName: "getResolver",
    args: [name.slice(0, -4)],
  });
  return resolver === zeroAddress ? zeroAddress : getAddress(resolver);
}
