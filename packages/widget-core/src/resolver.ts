import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
  getAddress,
  zeroAddress,
} from "viem";

/**
 * Minting a subname sets its owner and resolver but writes NO address record,
 * and the PublicResolver never falls back to the owner — a fresh name resolves
 * to 0x0. These helpers write the records so the name resolves to its holder.
 */

export const ENS_REGISTRY: Address = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

/** ENSIP-11 coin type for Ethereum mainnet. */
export const ETH_COIN_TYPE = 60n;
/** ENSIP-19 default EVM coin type: resolves on any EVM chain with no chain-specific record. */
export const DEFAULT_EVM_COIN_TYPE = 0x80000000n;
/** ENSIP-11 coin type for Base (0x80000000 | 8453). Not written: the default EVM record covers it. */
export const BASE_COIN_TYPE = 0x80000000n | 8453n;
/** Tip floor for the address write — enough to be included, far below a wallet's default. */
const MIN_PRIORITY_FEE = 10_000_000n; // 0.01 gwei

export const ensRegistryAbi = [
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
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
  /** Address on the ENSIP-19 default EVM record (Base and every other EVM chain), or null if unset. */
  defaultEvm: Address | null;
  /** True when both records point at `expected`. */
  linked: boolean;
}

function bytesToAddress(b: Hex): Address | null {
  if (!b || b === "0x" || b.length !== 42) return null;
  const a = getAddress(b);
  return a === zeroAddress ? null : a;
}

export async function getResolver(publicClient: PublicClient, node: Hex): Promise<Address> {
  return publicClient.readContract({
    address: ENS_REGISTRY,
    abi: ensRegistryAbi,
    functionName: "resolver",
    args: [node],
  }) as Promise<Address>;
}

/**
 * Read the name's ETH and default-EVM records and compare them to `expected`.
 * Throws if the name has no resolver — callers must not read a failed call as "unlinked".
 */
export async function getAddressStatus(
  publicClient: PublicClient,
  node: Hex,
  expected: Address,
): Promise<AddressStatus> {
  const resolver = await getResolver(publicClient, node);
  if (resolver === zeroAddress) throw new Error("Name has no resolver");
  const read = (coinType: bigint) =>
    publicClient.readContract({
      address: resolver,
      abi: publicResolverAbi,
      functionName: "addr",
      args: [node, coinType],
    }) as Promise<Hex>;
  const [eth, defaultEvm] = (await Promise.all([read(ETH_COIN_TYPE), read(DEFAULT_EVM_COIN_TYPE)])).map(
    bytesToAddress,
  );
  const want = getAddress(expected);
  return { resolver, eth, defaultEvm, linked: eth === want && defaultEvm === want };
}

/**
 * Calldata for the resolver calls that point one name at `addr`: the ETH record,
 * plus the ENSIP-19 default EVM record so strict clients resolve it on Base too
 * (a Base lookup never falls back to the ETH record).
 */
export function buildSetAddressCalls(node: Hex, addr: Address): Hex[] {
  const a = getAddress(addr);
  return [
    encodeFunctionData({ abi: publicResolverAbi, functionName: "setAddr", args: [node, a] }),
    encodeFunctionData({ abi: publicResolverAbi, functionName: "setAddr", args: [node, DEFAULT_EVM_COIN_TYPE, a] }),
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
