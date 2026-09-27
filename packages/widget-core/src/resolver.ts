import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
  getAddress,
  namehash,
  toHex,
  zeroAddress,
} from "viem";
import { packetToBytes } from "viem/ens";

/**
 * Minting a subname sets its owner and resolver but writes NO address record,
 * and the PublicResolver never falls back to the owner — a fresh name resolves
 * to 0x0. These helpers write the records so the name resolves to its holder.
 */

/**
 * ENS's canonical resolution entry point — a DAO-owned proxy that will be
 * upgraded for ENSv2, so finding resolvers through it survives the migration.
 */
export const UNIVERSAL_RESOLVER: Address = "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe";

/** ENSIP-11 coin type for Ethereum mainnet. */
export const ETH_COIN_TYPE = 60n;
/**
 * ENSIP-11 coin type for Base (0x80000000 | 8453). Written explicitly: a Base
 * lookup (`coinType: toCoinType(base.id)`, as the ENS docs direct) never falls
 * back to the ETH record, and the Universal Resolver ignores the ENSIP-19
 * default-EVM record on the PublicResolver these names use.
 */
export const BASE_COIN_TYPE = 0x80000000n | 8453n;
/** Tip floor for the address write — enough to be included, far below a wallet's default. */
const MIN_PRIORITY_FEE = 10_000_000n; // 0.01 gwei

export const universalResolverAbi = [
  {
    type: "function",
    name: "findResolver",
    stateMutability: "view",
    inputs: [{ name: "name", type: "bytes" }],
    outputs: [
      { name: "resolver", type: "address" },
      { name: "node", type: "bytes32" },
      { name: "offset", type: "uint256" },
    ],
  },
] as const;

export const publicResolverAbi = [
  {
    type: "function",
    name: "addr",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "coinType", type: "uint256" },
    ],
    outputs: [{ type: "bytes" }],
  },
  {
    type: "function",
    name: "setAddr",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "a", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAddr",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "coinType", type: "uint256" },
      { name: "a", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ type: "bytes[]" }],
  },
] as const;

export interface AddressStatus {
  resolver: Address;
  /** Address on the ETH record (coin type 60), or null if unset. */
  eth: Address | null;
  /** Address on the Base record, or null if unset. */
  base: Address | null;
  /** True when both records point at `expected`. */
  linked: boolean;
}

function bytesToAddress(b: Hex): Address | null {
  if (!b || b === "0x" || b.length !== 42) return null;
  const a = getAddress(b);
  return a === zeroAddress ? null : a;
}

/**
 * The resolver configured for `name` itself, looked up at call time through the
 * Universal Resolver — never hardcoded or cached (ENSv2 resolvers are per
 * account and change with ownership). Throws if the name has no resolver of its
 * own: an inherited parent resolver would reject the holder's writes.
 */
export async function getResolver(publicClient: PublicClient, name: string): Promise<Address> {
  const [resolver, , offset] = (await publicClient.readContract({
    address: UNIVERSAL_RESOLVER,
    abi: universalResolverAbi,
    functionName: "findResolver",
    args: [toHex(packetToBytes(name))],
  })) as readonly [Address, Hex, bigint];
  if (resolver === zeroAddress || offset !== 0n) throw new Error(`${name} has no resolver of its own`);
  return resolver;
}

/**
 * Read the name's ETH and Base records and compare them to `expected`.
 * Throws if the name has no resolver — callers must not read a failed call as "unlinked".
 */
export async function getAddressStatus(
  publicClient: PublicClient,
  name: string,
  expected: Address,
): Promise<AddressStatus> {
  const resolver = await getResolver(publicClient, name);
  const node = namehash(name);
  const read = (coinType: bigint) =>
    publicClient.readContract({
      address: resolver,
      abi: publicResolverAbi,
      functionName: "addr",
      args: [node, coinType],
    }) as Promise<Hex>;
  const [eth, base] = (await Promise.all([read(ETH_COIN_TYPE), read(BASE_COIN_TYPE)])).map(bytesToAddress);
  const want = getAddress(expected);
  return { resolver, eth, base, linked: eth === want && base === want };
}

/** Calldata for the resolver calls that point one name's ETH and Base records at `addr`. */
export function buildSetAddressCalls(node: Hex, addr: Address): Hex[] {
  const a = getAddress(addr);
  return [
    encodeFunctionData({ abi: publicResolverAbi, functionName: "setAddr", args: [node, a] }),
    encodeFunctionData({ abi: publicResolverAbi, functionName: "setAddr", args: [node, BASE_COIN_TYPE, a] }),
  ];
}

/**
 * One multicall on the resolver that points every node at `addr`. The sender
 * must own each name (the resolver checks NameWrapper ownership per call), so
 * run this after the mint has confirmed.
 */
export function buildSetAddressMulticall(nodes: Hex[], addr: Address): Hex {
  return encodeFunctionData({
    abi: publicResolverAbi,
    functionName: "multicall",
    args: [nodes.flatMap((n) => buildSetAddressCalls(n, addr))],
  });
}

/**
 * The network's own fee suggestion, with a small tip floor. Passed explicitly
 * because wallets default to a tip ~30x the base fee on a quiet mainnet.
 */
export async function getLowFees(publicClient: PublicClient) {
  const f = await publicClient.estimateFeesPerGas();
  const maxPriorityFeePerGas = f.maxPriorityFeePerGas > MIN_PRIORITY_FEE ? f.maxPriorityFeePerGas : MIN_PRIORITY_FEE;
  return { maxPriorityFeePerGas, maxFeePerGas: f.maxFeePerGas + maxPriorityFeePerGas };
}

export async function setAddress(
  wallet: WalletClient,
  args: {
    resolver: Address;
    nodes: Hex[];
    address: Address;
    account: Address;
    fees?: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };
  },
): Promise<Hex> {
  return wallet.writeContract({
    ...args.fees,
    address: args.resolver,
    abi: publicResolverAbi,
    functionName: "multicall",
    args: [args.nodes.flatMap((n) => buildSetAddressCalls(n, args.address))],
    account: args.account,
    chain: wallet.chain,
  });
}
