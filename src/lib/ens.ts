import { namehash, labelhash } from "viem/ens";
import { keccak256, encodePacked } from "viem";

export { namehash, labelhash };

export function makeSubnameNode(parentNode: `0x${string}`, label: string): `0x${string}` {
  return keccak256(encodePacked(["bytes32", "bytes32"], [parentNode, labelhash(label)]));
}

export function isValidLabel(label: string): boolean {
  if (label.length < 3) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  return /^[a-z0-9-]+$/.test(label);
}
