import {
  type Address,
  type Hex,
  type PublicClient,
  bytesToHex,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  hexToBytes,
  isAddress,
  namehash,
} from "viem";
import { toCoinType } from "viem/ens";
import { getResolver, publicResolverAbi } from "./resolver.js";
import { type EnsVersion, dnsEncode, ensVersion, permissionedResolverAbi } from "./ensv2.js";

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

/** CAIP-2 id of Solana mainnet, and its SLIP-44 coin type (ENSIP-9). */
export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const SOLANA_COIN_TYPE = 501n;

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** The 32 bytes of a base58 Solana public key, or null when it isn't one. */
export function solanaKeyBytes(key: string): Hex | null {
  let n = 0n;
  for (const ch of key) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const body: number[] = [];
  for (; n > 0n; n >>= 8n) body.unshift(Number(n & 0xffn));
  let zeros = 0;
  while (key[zeros] === "1") zeros++; // each leading "1" is a leading zero byte
  const bytes = new Uint8Array(zeros + body.length);
  bytes.set(body, zeros);
  return bytes.length === 32 ? bytesToHex(bytes) : null;
}

function solanaKey(bytes: Hex): string | null {
  const b = hexToBytes(bytes);
  if (b.length !== 32) return null;
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  let out = "";
  for (; n > 0n; n /= 58n) out = B58[Number(n % 58n)] + out;
  for (const x of b) {
    if (x !== 0) break;
    out = "1" + out;
  }
  return out;
}

/** ENS coin type of a network this module writes an address record for, or null. */
function addrCoinType(network: string): bigint | null {
  if (network === SOLANA_MAINNET) return SOLANA_COIN_TYPE;
  const evm = /^eip155:(\d+)$/.exec(network);
  return evm ? toCoinType(Number(evm[1])) : null;
}

/** One payment option from a 402 challenge. */
export interface PayeeAccept {
  network: string;
  payTo: string;
}

/** The records one name needs to authorize an endpoint. */
export interface PayeePlan {
  /** RFC 6454 origins, deduplicated. */
  origins: string[];
  /**
   * One primary payTo per network that has an ENS coin type (EVM chains and
   * Solana), written as an address record. `address` is the payTo as the 402
   * carries it; `value` is the record's bytes.
   */
  addrs: { network: string; coinType: bigint; address: string; value: Hex }[];
  /** CAIP-10 accounts that do not fit an address record: a second payTo on a network, or a network without a coin type (e.g. Lightning). */
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
 * payTo on each EVM network or on Solana becomes that network's address
 * record; anything else goes on the org.x402.payto list.
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
    const value = evm ? (isAddress(account) ? (account as Hex) : null) : network === SOLANA_MAINNET ? solanaKeyBytes(account) : null;
    const coinType = addrCoinType(network);
    if (value && coinType !== null && !addrs.some((a) => a.network === network)) {
      addrs.push({ network, coinType, address: account, value });
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
        args: [node, a.coinType, a.value],
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
 * The same records for an ENSv2 name: Permissioned Resolver setters, which take
 * the DNS-encoded name, and setAddress in place of setAddr.
 */
export function buildPayeeCallsV2(name: string, plan: PayeePlan): Hex[] {
  const dns = dnsEncode(name);
  return [
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: "setText",
      args: [dns, PAYEE_ORIGINS_KEY, plan.origins.join(" ")],
    }),
    ...plan.addrs.map((a) =>
      encodeFunctionData({
        abi: permissionedResolverAbi,
        functionName: "setAddress",
        args: [dns, a.coinType, a.value],
      }),
    ),
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: "setText",
      args: [dns, PAYEE_PAYTO_KEY, plan.payto.join(" ")],
    }),
  ];
}

/** One resolver transaction: a multicall carrying every listed name's payee records. */
export interface PayeeWrite {
  resolver: Address;
  names: string[];
  /** The resolver calls, for a wallet API that takes multicall's arguments. */
  calls: Hex[];
  /** The same multicall, encoded. */
  data: Hex;
}

/**
 * The transactions that write `plans`: one multicall per resolver, each name's
 * calls in the form its ENS version takes. Both resolver kinds share the
 * multicall(bytes[]) selector.
 */
export async function payeeWrites(
  publicClient: PublicClient,
  plans: { name: string; plan: PayeePlan }[],
): Promise<PayeeWrite[]> {
  const info = await Promise.all(
    plans.map(async ({ name }) => {
      const [version, resolver] = await Promise.all([ensVersion(publicClient, name), getResolver(publicClient, name)]);
      return { version, resolver };
    }),
  );
  const groups = new Map<Address, { names: string[]; calls: Hex[] }>();
  plans.forEach(({ name, plan }, i) => {
    const { version, resolver } = info[i];
    const g = groups.get(resolver) ?? { names: [], calls: [] };
    g.names.push(name);
    g.calls.push(...(version === "v2" ? buildPayeeCallsV2(name, plan) : buildPayeeCalls(namehash(name), plan)));
    groups.set(resolver, g);
  });
  return [...groups].map(([resolver, g]) => ({
    resolver,
    names: g.names,
    calls: g.calls,
    data: encodeFunctionData({ abi: publicResolverAbi, functionName: "multicall", args: [g.calls] }),
  }));
}

/**
 * Group names by resolver so each group is one multicall. Names minted here
 * share the registrar's resolver, but a holder can change theirs. For ENSv1
 * names only; payeeWrites handles both versions.
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

/**
 * Read one record from `resolver`. An ENSv2 Permissioned Resolver answers only
 * resolve(dnsName, getterCalldata), so the v1 getter is wrapped in it there.
 */
async function readRecord<F extends "text" | "addr">(
  publicClient: PublicClient,
  version: EnsVersion,
  resolver: Address,
  name: string,
  functionName: F,
  args: readonly [string] | readonly [bigint],
): Promise<F extends "text" ? string : Hex> {
  const node = namehash(name);
  const abi = functionName === "text" ? textResolverAbi : publicResolverAbi;
  const getter = encodeFunctionData({ abi, functionName, args: [node, ...args] } as never);
  const raw =
    version === "v2"
      ? await publicClient.readContract({ address: resolver, abi: permissionedResolverAbi, functionName: "resolve", args: [dnsEncode(name), getter] })
      : ((await publicClient.call({ to: resolver, data: getter })).data ?? "0x");
  return decodeFunctionResult({ abi, functionName, data: raw } as never) as never;
}

/** Current payee records of a name, for showing what a write would change. */
export async function readPayeeRecords(
  publicClient: PublicClient,
  name: string,
  networks: string[],
): Promise<{ origins: string; payto: string; addrs: Record<string, string | null> }> {
  const [version, resolver] = await Promise.all([ensVersion(publicClient, name), getResolver(publicClient, name)]);
  const text = (key: string) => readRecord(publicClient, version, resolver, name, "text", [key] as const);
  const withAddr = networks.filter((n) => addrCoinType(n) !== null);
  const [origins, payto, ...raw] = await Promise.all([
    text(PAYEE_ORIGINS_KEY),
    text(PAYEE_PAYTO_KEY),
    ...withAddr.map((n) => readRecord(publicClient, version, resolver, name, "addr", [addrCoinType(n)!] as const)),
  ]);
  const addrs: Record<string, string | null> = {};
  withAddr.forEach((n, i) => {
    const b = raw[i];
    if (n === SOLANA_MAINNET) addrs[n] = b && !/^0x0*$/.test(b) ? solanaKey(b) : null;
    else addrs[n] = b && b.length === 42 && !/^0x0{40}$/.test(b) ? getAddress(b) : null;
  });
  return { origins, payto, addrs };
}
