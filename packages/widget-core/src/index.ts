import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
  keccak256,
  namehash,
  stringToBytes,
  concat,
} from "viem";
import { registrarAbi, forwarderAbi } from "./abis.js";
import { validateLabel } from "./validation.js";

export { registrarAbi, forwarderAbi, validateLabel };

export interface X402Config {
  registrar: Address;
  forwarder: Address;
  publicClient: PublicClient;
}

export function parentNodeFor(ensName: string): Hex {
  return namehash(ensName);
}

export function subnameNode(parentNode: Hex, label: string): Hex {
  return keccak256(concat([parentNode, keccak256(stringToBytes(label))]));
}

export async function getMintFee(cfg: X402Config): Promise<bigint> {
  return cfg.publicClient.readContract({
    address: cfg.registrar,
    abi: registrarAbi,
    functionName: "mintFee",
  }) as Promise<bigint>;
}

export async function getMaxPlatformFee(cfg: X402Config): Promise<bigint> {
  return cfg.publicClient.readContract({
    address: cfg.forwarder,
    abi: forwarderAbi,
    functionName: "maxPlatformFee",
  }) as Promise<bigint>;
}

export async function isAvailable(
  cfg: X402Config,
  parentNode: Hex,
  label: string,
): Promise<boolean> {
  return cfg.publicClient.readContract({
    address: cfg.registrar,
    abi: registrarAbi,
    functionName: "isAvailable",
    args: [parentNode, label],
  }) as Promise<boolean>;
}

export interface RegisterArgs {
  parentNode: Hex;
  label: string;
  platformTreasury: Address;
  platformFee: bigint;
  user: Address;
}

/** Build calldata for a registerVia call. Lets hosts simulate or batch. */
export function buildRegisterViaCalldata(args: Omit<RegisterArgs, "user">) {
  return encodeFunctionData({
    abi: forwarderAbi,
    functionName: "registerVia",
    args: [args.parentNode, args.label, args.platformTreasury, args.platformFee],
  });
}

export async function registerVia(
  cfg: X402Config,
  wallet: WalletClient,
  args: RegisterArgs,
): Promise<Hex> {
  const protocolFee = await getMintFee(cfg);
  const value = protocolFee + args.platformFee;

  return wallet.writeContract({
    address: cfg.forwarder,
    abi: forwarderAbi,
    functionName: "registerVia",
    args: [args.parentNode, args.label, args.platformTreasury, args.platformFee],
    value,
    account: args.user,
    chain: wallet.chain,
  });
}
