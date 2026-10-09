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
  /** Whether the name's resolver implements ENSIP-10 (resolve(bytes,bytes)). */
  extendedResolver(name: string): Promise<boolean>;
}

export const ENS_REGISTRY = getAddress("0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e");
export const NAME_WRAPPER = getAddress("0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401");
export const BASE_REGISTRAR = getAddress("0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85");

const registryAbi = [
  {
    type: "function",
    name: "owner",
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
    async extendedResolver(name) {
      const resolver = await client.getEnsResolver({ name });
      if (!resolver || resolver === zeroAddress) return false;
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
