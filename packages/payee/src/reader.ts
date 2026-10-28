import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  getAddress,
  labelhash,
  namehash,
  zeroAddress,
  type Address,
  type PublicClient,
} from "viem";

/**
 * Every chain read the verifier needs. A method returns null for a record that
 * is genuinely unset and throws on a failed read, so the verifier can report a
 * throttled RPC as inconclusive instead of as a missing record.
 */
export interface EnsReader {
  /** Current block timestamp, in seconds. Expiry is judged by chain time, not the local clock. */
  now(): Promise<bigint>;
  text(name: string, key: string): Promise<string | null>;
  addr(name: string, coinType: bigint): Promise<string | null>;
  /** ENS registry owner of a node. */
  registryOwner(name: string): Promise<Address>;
  /** NameWrapper (owner, fuses, expiry) for a node. Only meaningful when the registry owner is the NameWrapper. */
  wrapperData(name: string): Promise<{ owner: Address; fuses: number; expiry: bigint }>;
  /** BaseRegistrar expiry of a .eth second-level name (without the grace period). */
  nameExpires(label: string): Promise<bigint>;
  /**
   * Expiry and grace period of a .eth second-level name, ENSv2-aware. Optional:
   * a reader without it falls back to nameExpires and the ENSv1 grace period.
   * An ENSv2 name has its own expiry and a 28-day grace; an unmigrated name that
   * ENSv2 already lists as available has been released, so its grace is zero.
   */
  secondLevel?(label: string): Promise<{ expiry: bigint; grace: bigint }>;
  /** Whether the name's resolver implements ENSIP-10 (resolve(bytes,bytes)). */
  extendedResolver(name: string): Promise<boolean>;
}

export const ENS_REGISTRY = getAddress("0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e");
export const NAME_WRAPPER = getAddress("0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401");
export const BASE_REGISTRAR = getAddress("0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85");
/** ENSv2's ETH registry: every .eth label, v2 names as registered, v1 names as reserved. */
export const ENSV2_ETH_REGISTRY = getAddress("0xf60aba43E1f7F3DAB1186Ff03B561401C9Df85E2");
const V2_AVAILABLE = 0;
const V2_REGISTERED = 2;
/** ENSv2's grace period for an expired .eth name. */
export const ENSV2_GRACE_PERIOD = 28n * 24n * 60n * 60n;
/** ENSv1's, for a name not migrated yet. */
const ENSV1_GRACE_PERIOD = 90n * 24n * 60n * 60n;

const ensV2RegistryAbi = [
  { type: "function", name: "getStatus", stateMutability: "view", inputs: [{ name: "anyId", type: "uint256" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "getExpiry", stateMutability: "view", inputs: [{ name: "anyId", type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "getResolver", stateMutability: "view", inputs: [{ name: "label", type: "string" }], outputs: [{ type: "address" }] },
] as const;

const registryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
] as const;

const nameWrapperAbi = [
  {
    type: "function",
    name: "getData",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
  },
] as const;

const baseRegistrarAbi = [
  {
    type: "function",
    name: "nameExpires",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const erc165Abi = [
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "view",
    inputs: [{ name: "interfaceID", type: "bytes4" }],
    outputs: [{ type: "bool" }],
  },
] as const;

/** ENSIP-10 IExtendedResolver interface id. */
const EXTENDED_RESOLVER_ID = "0x9061b923";

/** An EnsReader over a viem PublicClient connected to Ethereum mainnet. */
export function viemReader(client: PublicClient): EnsReader {
  return {
    async now() {
      return (await client.getBlock({ blockTag: "latest" })).timestamp;
    },
    text: (name, key) => client.getEnsText({ name, key, strict: true }).catch(nullIfUnset),
    addr: (name, coinType) =>
      client.getEnsAddress({ name, coinType, strict: true }).catch(nullIfUnset),
    registryOwner: (name) =>
      client.readContract({
        address: ENS_REGISTRY,
        abi: registryAbi,
        functionName: "owner",
        args: [namehash(name)],
      }),
    async wrapperData(name) {
      const [owner, fuses, expiry] = await client.readContract({
        address: NAME_WRAPPER,
        abi: nameWrapperAbi,
        functionName: "getData",
        args: [BigInt(namehash(name))],
      });
      return { owner, fuses, expiry };
    },
    nameExpires: (label) =>
      client.readContract({
        address: BASE_REGISTRAR,
        abi: baseRegistrarAbi,
        functionName: "nameExpires",
        args: [BigInt(labelhash(label))],
      }),
    async secondLevel(label) {
      const id = BigInt(labelhash(label));
      const status = Number(await client.readContract({ address: ENSV2_ETH_REGISTRY, abi: ensV2RegistryAbi, functionName: "getStatus", args: [id] }));
      if (status === V2_REGISTERED) {
        const expiry = await client.readContract({ address: ENSV2_ETH_REGISTRY, abi: ensV2RegistryAbi, functionName: "getExpiry", args: [id] });
        return { expiry: BigInt(expiry), grace: ENSV2_GRACE_PERIOD };
      }
      const expiry = await client.readContract({ address: BASE_REGISTRAR, abi: baseRegistrarAbi, functionName: "nameExpires", args: [id] });
      return { expiry, grace: status === V2_AVAILABLE ? 0n : ENSV1_GRACE_PERIOD };
    },
    async extendedResolver(name) {
      const labels = name.split(".");
      let resolver: Address = zeroAddress;
      // An ENSv2 name's resolver is the one the ETH registry holds for it.
      if (labels.length === 2 && labels[1] === "eth") {
        const status = Number(
          await client.readContract({ address: ENSV2_ETH_REGISTRY, abi: ensV2RegistryAbi, functionName: "getStatus", args: [BigInt(labelhash(labels[0]))] }),
        );
        if (status === V2_REGISTERED)
          resolver = await client.readContract({ address: ENSV2_ETH_REGISTRY, abi: ensV2RegistryAbi, functionName: "getResolver", args: [labels[0]] });
      }
      // Since ENSv2 the Universal Resolver (and so getEnsResolver) reports the
      // ENSV1Resolver wrapper for every v1 name, and the wrapper is extended.
      // For a v1 name, take the resolver ENSIP-10 would use: the nearest one set
      // in the registry on the name or an ancestor, up to the second-level name.
      for (let i = 0; i < labels.length - 1 && resolver === zeroAddress; i++) {
        resolver = await client.readContract({
          address: ENS_REGISTRY,
          abi: registryAbi,
          functionName: "resolver",
          args: [namehash(labels.slice(i).join("."))],
        });
      }
      // Not in the v1 registry at all: an ENSv2 name, whose resolver the library finds.
      if (resolver === zeroAddress) resolver = (await client.getEnsResolver({ name })) ?? zeroAddress;
      if (resolver === zeroAddress) return false;
      return client
        .readContract({
          address: resolver,
          abi: erc165Abi,
          functionName: "supportsInterface",
          args: [EXTENDED_RESOLVER_ID],
        })
        // A resolver without ERC-165 reverts here; that is a "no", not a failed read.
        .catch((err: unknown) => {
          if (isRevert(err)) return false;
          throw err;
        });
    },
  };
}

/**
 * Universal Resolver errors that mean "this name has no such record".
 * viem's non-strict mode also maps `HttpError` (a CCIP-Read gateway that
 * failed) and `ResolverError` (the resolver reverted) to null, which would
 * publish a gateway outage as "origin not listed". Those stay failures here.
 */
const UNSET_ERRORS = new Set(["ResolverNotFound", "ResolverNotContract", "UnsupportedResolverProfile"]);

function nullIfUnset(err: unknown): null {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && UNSET_ERRORS.has(revert.data?.errorName ?? "")) {
      return null;
    }
  }
  throw err;
}

/** A plain contract revert (e.g. a resolver without ERC-165), as opposed to a failed request. */
function isRevert(err: unknown): boolean {
  return (
    err instanceof BaseError &&
    err.walk((e) => e instanceof ContractFunctionRevertedError || e instanceof ContractFunctionZeroDataError) !== null
  );
}
