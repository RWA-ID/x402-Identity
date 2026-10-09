import { type Address, type Hex, type PublicClient, encodeFunctionData, getAddress, isAddress, namehash } from "viem";
import { toCoinType } from "viem/ens";
import { getResolver, publicResolverAbi } from "./resolver.js";

/**
 * Records for the x402 `payee-name` extension (specs/extensions/payee-name.md):
 * a name lists the origins allowed to declare it and the payTo addresses it
 * authorizes. Key names match @x402identity/payee.
 */
export const PAYEE_ORIGINS_KEY = "org.x402.origins";
export const PAYEE_PAYTO_KEY = "org.x402.payto";

export const textResolverAbi = [
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ type: "string" }],
  },
] as const;

/** One payment option from a 402 challenge. */
export interface PayeeAccept {
  network: string;
  payTo: string;
}

/** The records one name needs to authorize an endpoint. */
export interface PayeePlan {
  /** RFC 6454 origins, deduplicated. */
  origins: string[];
  /** One primary payTo per EVM network, written as an address record. */
  addrs: { network: string; coinType: bigint; address: Address }[];
  /** CAIP-10 accounts that do not fit an address record: a second payTo on a network, or a non-EVM network. */
  payto: string[];
}

/** RFC 6454 origin of an http(s) URL, or null. */
export function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * Plan the records that authorize `accepts` for the given origins. The first
 * payTo on each EVM network becomes that chain's address record; anything else
 * goes on the org.x402.payto list.
 */
export function planPayeeRecords(origins: string[], accepts: PayeeAccept[]): PayeePlan {
  const cleanOrigins = [...new Set(origins.map(originOf).filter((o): o is string => o !== null))];
  const addrs: PayeePlan["addrs"] = [];
  const payto: string[] = [];
  const seen = new Set<string>();
  for (const { network, payTo } of accepts) {
    const evm = /^eip155:(\d+)$/.exec(network);
    const account = evm && isAddress(payTo, { strict: false }) ? getAddress(payTo) : payTo;
    const key = `${network}:${evm ? account.toLowerCase() : account}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (evm && isAddress(account) && !addrs.some((a) => a.network === network)) {
      addrs.push({ network, coinType: toCoinType(Number(evm[1])), address: account });
    } else {
      payto.push(`${network}:${account}`);
    }
  }
  return { origins: cleanOrigins, addrs, payto };
}

/**
 * Resolver calldata for one name. org.x402.payto is always written, empty
 * included: a list left over from an earlier setup would keep authorizing
 * addresses the operator no longer uses.
 */
export function buildPayeeCalls(node: Hex, plan: PayeePlan): Hex[] {
  return [
    encodeFunctionData({
      abi: textResolverAbi,
      functionName: "setText",
      args: [node, PAYEE_ORIGINS_KEY, plan.origins.join(" ")],
    }),
    ...plan.addrs.map((a) =>
      encodeFunctionData({
        abi: publicResolverAbi,
        functionName: "setAddr",
        args: [node, a.coinType, a.address],
      }),
    ),
    encodeFunctionData({
      abi: textResolverAbi,
      functionName: "setText",
      args: [node, PAYEE_PAYTO_KEY, plan.payto.join(" ")],
    }),
  ];
}

/**
 * Group names by resolver so each group is one multicall. Names minted here
 * share the registrar's resolver, but a holder can change theirs.
 */
export async function groupByResolver(
  publicClient: PublicClient,
  names: string[],
): Promise<Map<Address, string[]>> {
  const resolvers = await Promise.all(names.map((n) => getResolver(publicClient, n)));
  const groups = new Map<Address, string[]>();
  names.forEach((n, i) => groups.set(resolvers[i], [...(groups.get(resolvers[i]) ?? []), n]));
  return groups;
}

/** Current payee records of a name, for showing what a write would change. */
export async function readPayeeRecords(
  publicClient: PublicClient,
  name: string,
  networks: string[],
): Promise<{ origins: string; payto: string; addrs: Record<string, Address | null> }> {
  const resolver = await getResolver(publicClient, name);
  const node = namehash(name);
  const text = (key: string) =>
    publicClient.readContract({ address: resolver, abi: textResolverAbi, functionName: "text", args: [node, key] });
  const evm = networks.filter((n) => /^eip155:\d+$/.test(n));
  const [origins, payto, ...raw] = await Promise.all([
    text(PAYEE_ORIGINS_KEY),
    text(PAYEE_PAYTO_KEY),
    ...evm.map((n) =>
      publicClient.readContract({
        address: resolver,
        abi: publicResolverAbi,
        functionName: "addr",
        args: [node, toCoinType(Number(n.split(":")[1]))],
      }) as Promise<Hex>,
    ),
  ]);
  const addrs: Record<string, Address | null> = {};
  evm.forEach((n, i) => {
    const b = raw[i];
    addrs[n] = b && b.length === 42 && !/^0x0{40}$/.test(b) ? getAddress(b) : null;
  });
  return { origins, payto, addrs };
}
