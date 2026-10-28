import { isAddress, getAddress, hexToBytes, isHex, zeroAddress } from "viem";
import { normalize, toCoinType } from "viem/ens";
import { NAME_WRAPPER, type EnsReader } from "./reader.js";

export const EXTENSION_KEY = "payee-name";
export const ORIGINS_KEY = "org.x402.origins";
export const PAYTO_KEY = "org.x402.payto";

/** Seconds a .eth second-level name keeps resolving after it expires. */
export const ETH_GRACE_PERIOD = 90n * 24n * 60n * 60n;
/** NameWrapper fuse: the parent can no longer replace or rewrite this name. */
export const PARENT_CANNOT_CONTROL = 0x10000;

/** Closed, append-only set (spec: Reason codes). */
export type Reason =
  | "payee-bound"
  | "name-not-normalized"
  | "origin-not-listed"
  | "payto-not-listed"
  | "name-expired"
  | "name-in-grace"
  | "no-records"
  | "resolution-failed"
  | "unsupported-name";

export interface PayeeVerdict {
  verdict: true | false | "inconclusive";
  reason: Reason;
  accepts_index: number;
  name: string;
  detail?: { field: string; expected: string; got: string };
  matched_by?: "addr" | typeof PAYTO_KEY;
  expires_at?: string;
  parent_can_control?: boolean | "unknown";
  extended_resolver?: boolean | "unknown";
  checked_at: string;
}

/** The subset of a v2 PaymentRequired this extension reads. */
export interface PaymentRequiredLike {
  accepts: ReadonlyArray<{ network: string; payTo: string }>;
  extensions?: Record<string, unknown>;
}

/** A failed chain read, kept apart from an unset record. */
class ReadFailed extends Error {}

async function read<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new ReadFailed((err as { shortMessage?: string }).shortMessage ?? (err as Error).message);
  }
}

/** The declared name, or undefined when the challenge does not carry the extension. */
export function declaredName(pr: PaymentRequiredLike): string | undefined {
  const ext = pr.extensions?.[EXTENSION_KEY] as { info?: { name?: unknown } } | undefined;
  return typeof ext?.info?.name === "string" ? ext.info.name : undefined;
}

/** RFC 6454 ASCII origin, or null when the string is not an absolute http(s) URL. */
export function toOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** CAIP-2 id of Solana mainnet. */
export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
/** SLIP-44 coin type of Solana (ENSIP-9). Its address record holds the 32-byte public key. */
export const SOLANA_COIN_TYPE = 501n;
/** ENSIP-19 default EVM coin type: the address for every EVM chain without its own record. */
export const DEFAULT_EVM_COIN_TYPE = 0x80000000n;

/** ENS coin type for a CAIP-2 network, or null when this draft defines none. */
export function coinTypeFor(network: string): bigint | null {
  if (network === SOLANA_MAINNET) return SOLANA_COIN_TYPE;
  const m = /^eip155:(\d+)$/.exec(network);
  return m ? toCoinType(Number(m[1])) : null;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  for (; n > 0n; n /= 58n) out = B58[Number(n % 58n)] + out;
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

/**
 * An address record's value in the form `payTo` takes on `network`, or null
 * when it is not a valid account there. Readers return the record's raw bytes
 * as hex for any coin type; an EVM address may also come back checksummed.
 */
function recordAccount(network: string, value: string): string | null {
  if (network === SOLANA_MAINNET) {
    if (!isHex(value)) return null;
    const bytes = hexToBytes(value);
    return bytes.length === 32 ? base58(bytes) : null;
  }
  return value;
}

function sameAccount(network: string, a: string, b: string): boolean {
  if (network.startsWith("eip155:")) {
    return isAddress(a, { strict: false }) && isAddress(b, { strict: false }) && getAddress(a) === getAddress(b);
  }
  return a === b;
}

function splitList(value: string | null): string[] {
  return value ? value.split(/\s+/).filter(Boolean) : [];
}

/**
 * Verify a 402 challenge's `payee-name` declaration.
 *
 * @param pr     the decoded PaymentRequired
 * @param origin the origin the client actually contacted, from its own connection.
 *               Never `resource.url`: the server writes that.
 * @returns one verdict per entry in `accepts`, or null when the challenge
 *          does not declare `payee-name`.
 */
export async function verifyPayee(
  pr: PaymentRequiredLike,
  origin: string,
  reader: EnsReader,
): Promise<PayeeVerdict[] | null> {
  const declared = declaredName(pr);
  if (declared === undefined) return null;

  const checked_at = new Date().toISOString();
  const all = (v: Omit<PayeeVerdict, "accepts_index" | "checked_at">): PayeeVerdict[] =>
    pr.accepts.map((_, i) => ({ ...v, accepts_index: i, checked_at }));

  // 1. Name. A lookalike is the main impersonation vector, so a declared name
  // that normalization would change is refused, never quietly normalized.
  let normalized: string | null;
  try {
    normalized = normalize(declared);
  } catch {
    normalized = null;
  }
  if (normalized !== declared) {
    return all({
      verdict: false,
      reason: "name-not-normalized",
      name: declared,
      detail: { field: "info.name", expected: normalized ?? "(not normalizable)", got: declared },
    });
  }
  const name = declared;
  const labels = name.split(".");
  if (labels.length < 2 || labels[labels.length - 1] !== "eth") {
    return all({ verdict: "inconclusive", reason: "unsupported-name", name });
  }

  const contacted = toOrigin(origin);
  if (!contacted) throw new TypeError(`origin must be an absolute http(s) URL or origin, got ${origin}`);

  const networks = [...new Set(pr.accepts.map((a) => a.network))];

  let resolved: {
    now: bigint;
    origins: string[];
    payto: string[];
    addrs: Map<string, string | null>;
    expiry: { at: bigint; grace: bigint };
    secondLevel: string;
    registered: boolean;
    parentCanControl: boolean;
    extendedResolver: boolean | "unknown";
  };
  try {
    resolved = await resolveAll(reader, name, labels, networks);
  } catch (err) {
    if (!(err instanceof ReadFailed)) throw err;
    return all({
      verdict: "inconclusive",
      reason: "resolution-failed",
      name,
      detail: { field: "resolution", expected: "answer", got: err.message },
    });
  }

  const common = {
    name,
    expires_at: new Date(Number(resolved.expiry.at) * 1000).toISOString(),
    parent_can_control: resolved.parentCanControl,
    extended_resolver: resolved.extendedResolver,
  };

  // 3. Expiry. An expired name still resolves and still passes the record
  // checks below, so it is judged first, on chain time.
  if (resolved.now >= resolved.expiry.at + resolved.expiry.grace) {
    // No expiry on record: the .eth name is not registered at all, which a
    // mistyped name looks like. Same verdict, but say so.
    const detail = resolved.registered
      ? undefined
      : { field: resolved.secondLevel, expected: "registered", got: "not registered" };
    return all({ verdict: false, reason: "name-expired", ...common, ...(detail && { detail }) });
  }
  if (resolved.now >= resolved.expiry.at) {
    return all({ verdict: "inconclusive", reason: "name-in-grace", ...common });
  }

  const anyAddr = [...resolved.addrs.values()].some(Boolean);
  if (!resolved.origins.length && !resolved.payto.length && !anyAddr) {
    return all({ verdict: "inconclusive", reason: "no-records", ...common });
  }

  // 4. Origin. Without this anyone could declare a well-known name.
  const listed = resolved.origins.map(toOrigin).filter((o): o is string => o !== null);
  if (!listed.includes(contacted)) {
    return all({
      verdict: false,
      reason: "origin-not-listed",
      ...common,
      detail: { field: ORIGINS_KEY, expected: contacted, got: listed.join(" ") || "(empty)" },
    });
  }

  // 5. Payee, per accept.
  return pr.accepts.map((accept, i): PayeeVerdict => {
    const record = resolved.addrs.get(accept.network);
    const primary = record ? recordAccount(accept.network, record) : null;
    if (primary && sameAccount(accept.network, primary, accept.payTo)) {
      return { verdict: true, reason: "payee-bound", accepts_index: i, matched_by: "addr", ...common, checked_at };
    }
    const inList = resolved.payto.some((entry) => {
      const cut = entry.lastIndexOf(":");
      return cut > 0 && entry.slice(0, cut) === accept.network && sameAccount(accept.network, entry.slice(cut + 1), accept.payTo);
    });
    if (inList) {
      return { verdict: true, reason: "payee-bound", accepts_index: i, matched_by: PAYTO_KEY, ...common, checked_at };
    }
    return {
      verdict: false,
      reason: "payto-not-listed",
      accepts_index: i,
      ...common,
      detail: { field: "payTo", expected: `listed for ${accept.network}`, got: accept.payTo },
      checked_at,
    };
  });
}

async function resolveAll(reader: EnsReader, name: string, labels: string[], networks: string[]) {
  // Ancestors from the name itself up to the .eth second-level name.
  const path = labels.slice(0, -1).map((_, i) => labels.slice(i).join("."));
  const secondLevel = path[path.length - 1];
  const subnames = path.slice(0, -1);

  const anyEvm = networks.some((n) => n.startsWith("eip155:"));

  const [now, originsRaw, paytoRaw, addrEntries, defaultEvm, secondLevelExpiry, subnameData, extendedResolver] =
    await Promise.all([
      read(() => reader.now()),
      read(() => reader.text(name, ORIGINS_KEY)),
      read(() => reader.text(name, PAYTO_KEY)),
      Promise.all(
        networks.map(async (network) => {
          const coinType = coinTypeFor(network);
          const value = coinType === null ? null : await read(() => reader.addr(name, coinType));
          return [network, value] as const;
        }),
      ),
      anyEvm ? read(() => reader.addr(name, DEFAULT_EVM_COIN_TYPE)) : null,
      read(() => {
        const label = labels[labels.length - 2];
        return reader.secondLevel
          ? reader.secondLevel(label)
          : reader.nameExpires(label).then((expiry) => ({ expiry, grace: ETH_GRACE_PERIOD }));
      }),
      Promise.all(
        subnames.map(async (node) => {
          const owner = await read(() => reader.registryOwner(node));
          const wrapped = owner.toLowerCase() === NAME_WRAPPER.toLowerCase();
          return { node, wrapped, data: wrapped ? await read(() => reader.wrapperData(node)) : null };
        }),
      ),
      // Informational only: a failed probe must not sink the verdict.
      reader.extendedResolver(name).catch(() => "unknown" as const),
    ]);

  // Effective expiry: the earliest along the path. A wrapped subname's own
  // expiry only ends it when PARENT_CANNOT_CONTROL was burned: NameWrapper then
  // zeroes the owner once it passes. Without that fuse the expiry changes
  // nothing and the name lives as long as its parent. getData zeroes fuses
  // after expiry, so a passed expiry is recognized by the zeroed owner.
  let at = secondLevelExpiry.expiry;
  let grace = secondLevelExpiry.grace;
  for (const s of subnameData) {
    if (!s.data) continue;
    const ends =
      s.data.expiry > now
        ? (s.data.fuses & PARENT_CANNOT_CONTROL) !== 0
        : s.data.owner === zeroAddress;
    if (ends && s.data.expiry < at + grace) {
      at = s.data.expiry;
      grace = 0n;
    }
  }

  // The .eth registrar cannot touch a second-level name's records. Each
  // subname level is safe from its parent only when wrapped with
  // PARENT_CANNOT_CONTROL burned; every level must hold, or an ancestor's
  // owner can rewrite the whole subtree.
  const parentCanControl = subnameData.some(
    (s) => !s.data || (s.data.fuses & PARENT_CANNOT_CONTROL) === 0,
  );

  return {
    now,
    origins: splitList(originsRaw),
    payto: splitList(paytoRaw),
    // ENSIP-19: an EVM chain with no address of its own takes the default
    // address. Most deployed resolvers, ENS's own PublicResolver included,
    // don't apply this, so the verifier does.
    addrs: new Map(
      addrEntries.map(([network, value]) => [network, value ?? (network.startsWith("eip155:") ? defaultEvm : null)] as const),
    ),
    expiry: { at, grace },
    secondLevel,
    registered: secondLevelExpiry.expiry !== 0n,
    parentCanControl,
    extendedResolver,
  };
}
