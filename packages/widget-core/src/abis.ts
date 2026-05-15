export const registrarAbi = [
  {
    type: "function",
    name: "mintFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isAvailable",
    stateMutability: "view",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getParentList",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32[]" }],
  },
] as const;

export const forwarderAbi = [
  {
    type: "function",
    name: "maxPlatformFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "registerVia",
    stateMutability: "payable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
      { name: "platformTreasury", type: "address" },
      { name: "platformFee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "RegisteredVia",
    inputs: [
      { name: "platformTreasury", type: "address", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "parentNode", type: "bytes32", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "protocolFee", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
] as const;
