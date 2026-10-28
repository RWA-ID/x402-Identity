// Which .eth names a wallet can write payee records to. No React here, so a
// script can run the same checks the /verify wizard runs.
import { encodeFunctionData, getAddress, labelhash, namehash, zeroAddress, type Address, type PublicClient } from "viem";
import { normalize } from "viem/ens";
import { PAYEE_ORIGINS_KEY, publicResolverAbi, textResolverAbi } from "@x402identity/widget-core";
import { ADDRESSES } from "./contracts";
import { SITE_NFT_API } from "./alchemy";

/** The .eth registrar's ERC-721: one token per unwrapped second-level name, id = labelhash. */
const BASE_REGISTRAR: Address = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
/** ENS's 2020 PublicResolver. It predates the NameWrapper, so it rejects a wrapped name's owner. */
const LEGACY_RESOLVER: Address = "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41";
/**
 * ENSv2's .eth registry. Its status for a label is the authority on whether an
 * expired v1 name can still be renewed: the v1 registrar's 90-day grace no
 * longer decides when a name is released.
 */
const V2_ETH_REGISTRY: Address = "0xf60aba43E1f7F3DAB1186Ff03B561401C9Df85E2";
const V2_AVAILABLE = 0;
const V2_REGISTERED = 2;

/** The reason given for a name the wallet doesn't control, which the list leaves out. */
export const NOT_CONTROLLED = "This wallet doesn't control it.";
/** The reason given for a name past its grace period, which the list also leaves out. */
export const RELEASED = "Expired and released: anyone can register it now.";

const ownerOfAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

const registryAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }], outputs: [{ type: "address" }] },
  { type: "function", name: "resolver", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }], outputs: [{ type: "address" }] },
] as const;

const nameExpiresAbi = [
  { type: "function", name: "nameExpires", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

/** 0 available, 1 reserved (an unmigrated v1 name), 2 registered on ENSv2. */
const v2StatusAbi = [
  { type: "function", name: "getStatus", stateMutability: "view", inputs: [{ name: "anyId", type: "uint256" }], outputs: [{ type: "uint8" }] },
] as const;

type Client = Pick<PublicClient, "getBlock" | "multicall" | "call">;

/** A name the wizard can write payee records to, or why it can't. */
export type NameEntry = { name: string; ok: true } | { name: string; ok: false; reason: string };

type IndexedToken = { contract: Address; tokenId: string; name: string | null };
type OwnedNftsPage = {
  ownedNfts?: { contract: { address: string }; tokenId: string; name?: string | null }[];
  pageKey?: string;
};

/** One Alchemy NFT API call, retried once after a short wait if it is throttled. */
async function fetchJson(url: string): Promise<OwnedNftsPage> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Name lookup failed (HTTP ${res.status})`);
    return res.json();
  }
}

/** Wrapped names and unwrapped .eth names the NFT index lists for `owner`, every page. */
async function indexedTokens(owner: Address): Promise<IndexedToken[]> {
  if (!SITE_NFT_API) throw new Error("Name lookup isn't configured");
  const out: IndexedToken[] = [];
  let pageKey: string | undefined;
  do {
    const q = new URLSearchParams({ owner, withMetadata: "true", pageSize: "100" });
    q.append("contractAddresses[]", ADDRESSES.mainnet.nameWrapper);
    q.append("contractAddresses[]", BASE_REGISTRAR);
    if (pageKey) q.set("pageKey", pageKey);
    const json = await fetchJson(`${SITE_NFT_API}/getNFTsForOwner?${q}`);
    for (const n of json.ownedNfts ?? [])
      out.push({ contract: getAddress(n.contract.address), tokenId: n.tokenId, name: n.name ?? null });
    pageKey = json.pageKey;
  } while (pageKey);
  return out;
}

/** A name the index has not labelled yet (a fresh mint), from ENS's metadata service. */
async function nameFromMetadata(t: IndexedToken): Promise<string | null> {
  try {
    const hex = "0x" + BigInt(t.tokenId).toString(16).padStart(64, "0");
    const res = await fetch(`https://metadata.ens.domains/mainnet/${t.contract}/${hex}`);
    return res.ok ? ((await res.json()).name ?? null) : null;
  } catch {
    return null;
  }
}

/** The name in ENSIP-15 normalized form if it already is, else null. */
function normalized(name: string): string | null {
  try {
    return normalize(name) === name ? name : null;
  } catch {
    return null;
  }
}

/**
 * Candidate .eth names for `owner`. A label is kept only if it is normalized and
 * hashes to its own token id (namehash for a wrapped name, labelhash for an
 * unwrapped one), so a name the index mislabels can't stand in for another.
 */
export async function candidateNames(owner: Address): Promise<string[]> {
  const names = new Set<string>();
  for (const t of await indexedTokens(owner)) {
    const name = normalized(t.name || (await nameFromMetadata(t)) || "");
    if (!name || !name.endsWith(".eth")) continue;
    const wrapped = t.contract === getAddress(ADDRESSES.mainnet.nameWrapper);
    if (wrapped) {
      if (BigInt(namehash(name)) !== BigInt(t.tokenId)) continue;
    } else {
      const labels = name.split(".");
      if (labels.length !== 2 || BigInt(labelhash(labels[0])) !== BigInt(t.tokenId)) continue;
    }
    names.add(name);
  }
  return [...names];
}

/**
 * Whether `owner` can write payee records to each name, judged the way ENS judges
 * it: the name's controller is its registry owner, or its NameWrapper owner when
 * the registry owner is the NameWrapper. The name must still be an ENSv1 name,
 * be unexpired (past its expiry the verifier stops vouching for it, grace period
 * included) and have a resolver, and a simulated write from `owner` must succeed,
 * which covers custom resolvers and approvals the checks above can't see.
 * Throws on a failed read.
 */
export async function checkNames(client: Client, names: string[], owner: Address): Promise<NameEntry[]> {
  if (names.length === 0) return [];
  const me = getAddress(owner);
  const wrapper = getAddress(ADDRESSES.mainnet.nameWrapper);
  const secondLevel = (n: string) => n.split(".").slice(-2)[0];
  const [block, reads] = await Promise.all([
    client.getBlock({ blockTag: "latest" }),
    client.multicall({
      allowFailure: true,
      contracts: names.flatMap((n) => [
        { address: ADDRESSES.mainnet.ensRegistry, abi: registryAbi, functionName: "owner" as const, args: [namehash(n)] as const },
        { address: ADDRESSES.mainnet.ensRegistry, abi: registryAbi, functionName: "resolver" as const, args: [namehash(n)] as const },
        { address: wrapper, abi: ownerOfAbi, functionName: "ownerOf" as const, args: [BigInt(namehash(n))] as const },
        { address: BASE_REGISTRAR, abi: nameExpiresAbi, functionName: "nameExpires" as const, args: [BigInt(labelhash(secondLevel(n)))] as const },
        { address: BASE_REGISTRAR, abi: ownerOfAbi, functionName: "ownerOf" as const, args: [BigInt(labelhash(secondLevel(n)))] as const },
        { address: V2_ETH_REGISTRY, abi: v2StatusAbi, functionName: "getStatus" as const, args: [BigInt(labelhash(secondLevel(n)))] as const },
      ]),
    }),
  ]);

  return Promise.all(
    names.map(async (name, i): Promise<NameEntry> => {
      const [regOwner, resolver, wrapOwner, expires, registrant, v2Status] = reads.slice(i * 6, i * 6 + 6);
      if (regOwner.status !== "success" || resolver.status !== "success" || expires.status !== "success" || v2Status.status !== "success")
        throw new Error(`Couldn't read ${name}`);
      const registry = getAddress(regOwner.result as Address);
      const status = Number(v2Status.result);
      if (status === V2_REGISTERED) return { name, ok: false, reason: "This is an ENSv2 name. ENSv2 support is coming soon." };
      if (status === V2_AVAILABLE)
        return registry === zeroAddress && (expires.result as bigint) === 0n
          ? { name, ok: false, reason: "This name isn't registered." }
          : { name, ok: false, reason: RELEASED };
      if ((expires.result as bigint) <= block.timestamp)
        return { name, ok: false, reason: "Expired, still in its grace period: renew it in the ENS app first." };

      const controller =
        registry === wrapper
          ? wrapOwner.status === "success" ? getAddress(wrapOwner.result as Address) : zeroAddress
          : registry;
      if (controller !== me) {
        const isRegistrant = name.split(".").length === 2 && registrant.status === "success" && getAddress(registrant.result as Address) === me;
        return isRegistrant
          ? { name, ok: false, reason: "You own it, but its manager is another address. Set yourself as manager in the ENS app." }
          : { name, ok: false, reason: NOT_CONTROLLED };
      }

      const res = getAddress(resolver.result as Address);
      if (res === zeroAddress) return { name, ok: false, reason: "No resolver set. Set one in the ENS app first." };
      // The exact kind of write the wizard sends. Simulated, so it changes nothing.
      const probe = encodeFunctionData({
        abi: textResolverAbi,
        functionName: "setText",
        args: [namehash(name), PAYEE_ORIGINS_KEY, ""],
      });
      try {
        await client.call({
          account: me,
          to: res,
          data: encodeFunctionData({ abi: publicResolverAbi, functionName: "multicall", args: [[probe]] }),
        });
      } catch {
        return registry === wrapper && res === getAddress(LEGACY_RESOLVER)
          ? { name, ok: false, reason: "Its resolver predates the NameWrapper. Switch it to the current Public Resolver in the ENS app." }
          : { name, ok: false, reason: "Its resolver won't accept records from this wallet (a custom or offchain resolver)." };
      }
      return { name, ok: true };
    }),
  );
}
