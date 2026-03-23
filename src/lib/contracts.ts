import { type Address } from "viem";

export const ADDRESSES = {
  mainnet: {
    registrar: "0x0a9b0d20e9193dc5479ab98154124f4e2f569444" as Address,
    nameWrapper: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401" as Address,
    publicResolver: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63" as Address,
    ensRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as Address,
  },
  sepolia: {
    registrar: "0x0000000000000000000000000000000000000000" as Address, // fill after deploy
    nameWrapper: "0x0635513f179D50A207757E05759CbD106d7dFbE" as Address,
    publicResolver: "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD" as Address,
    ensRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as Address,
  },
} as const;

export const REGISTRAR_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "batchRegister",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "parentNodes", type: "bytes32[]" },
      { name: "labels", type: "string[]" },
    ],
    outputs: [],
  },
  {
    name: "isAvailable",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
    ],
    outputs: [{ name: "available", type: "bool" }],
  },
  {
    name: "mintFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "SubnameMinted",
    type: "event",
    inputs: [
      { name: "parentNode", type: "bytes32", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "subnameNode", type: "bytes32", indexed: false },
      { name: "minter", type: "address", indexed: true },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
] as const;
