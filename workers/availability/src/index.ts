// x402id-availability — a paid ($0.001 USDC on Base) availability check for
// x402 Identity Hub names, listed in the x402 Bazaar / agentic.market.
//
// Its job is discovery: someone browsing agentic.market asks their agent to
// check a name, and the answer carries a link to the site where they register
// it. The endpoint only READS mainnet, so it needs no funded wallet.
//
// Payment reaches the x402id Safe on Base. The middleware settles only when the
// handler answers < 400, so a bad name or a failed chain read never charges.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import type { RoutesConfig } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createFacilitatorConfig } from "@coinbase/x402";
import { createPublicClient, fallback, formatEther, http, namehash, type Address } from "viem";
import { mainnet } from "viem/chains";

type Env = {
  CDP_API_KEY_ID: string;
  CDP_API_KEY_SECRET: string;
  // Local testing only: a keyless facilitator (https://x402.org/facilitator)
  // on Base Sepolia. Unset in production, where the CDP facilitator is what
  // catalogs the route in the Bazaar / agentic.market.
  TEST_FACILITATOR_URL?: string;
  MAINNET_RPC_URL?: string;
  PUBLIC_URL: string;
};

// x402id Safe on Base (2-of-3, v1.5.0) — receives the fees.
const PAY_TO = "0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C";
const BASE = "eip155:8453" as const;
const BASE_SEPOLIA = "eip155:84532" as const;
const PRICE = "$0.001";
const REGISTRAR: Address = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";
const SITE = "https://x402id.eth.limo/";
const ICON = "https://x402id.eth.limo/favicon-512.png";
const PARENTS = ["402bot.eth", "402api.eth", "402mcp.eth"] as const;
const ROUTE = "/v1/availability/:name";

const registrarAbi = [
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
    name: "mintFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Mirrors X402SubnameRegistrar._isValidLabel + length check (widget-core/validation.ts). */
function labelError(label: string): string | null {
  if (label.length < 3) return "Label must be at least 3 characters";
  if (label.length > 63) return "Label too long";
  if (label.startsWith("-") || label.endsWith("-")) return "No leading or trailing hyphen";
  if (!/^[a-z0-9-]+$/.test(label)) return "Only lowercase a-z, 0-9 and hyphens";
  return null;
}

function parseName(raw: string): { label: string; parent: (typeof PARENTS)[number] } | { error: string } {
  const name = decodeURIComponent(raw).trim().toLowerCase();
  const parent = PARENTS.find((p) => name.endsWith(`.${p}`));
  if (!parent) return { error: `Name must end in ${PARENTS.map((p) => `.${p}`).join(", ")} (e.g. mybot.402bot.eth)` };
  const label = name.slice(0, -(parent.length + 1));
  if (label.includes(".")) return { error: "Only one label below the parent (e.g. mybot.402bot.eth)" };
  const err = labelError(label);
  return err ? { error: err } : { label, parent };
}

const outputExample = {
  name: "mybot.402bot.eth",
  available: true,
  mintFee: { wei: "1500000000000000", eth: "0.0015" },
  registerUrl: SITE,
  message: "mybot.402bot.eth is available. Register it at https://x402id.eth.limo/ for 0.0015 ETH plus gas (Ethereum mainnet).",
};

function routes(network: typeof BASE | typeof BASE_SEPOLIA): RoutesConfig {
  return {
    [`GET ${ROUTE}`]: {
      accepts: { scheme: "exact", price: PRICE, network, payTo: PAY_TO },
      description:
        "Check whether an ENS identity name for an AI agent, API or MCP server is available on x402 Identity Hub " +
        "(*.402bot.eth, *.402api.eth, *.402mcp.eth). Returns availability, the mint fee and where to register.",
      mimeType: "application/json",
      serviceName: "x402 Identity Hub",
      tags: ["ens", "identity", "agents", "names", "x402"],
      iconUrl: ICON,
      extensions: {
        ...declareDiscoveryExtension({
          pathParamsSchema: {
            properties: {
              name: {
                type: "string",
                description:
                  "Full name to check: a label (3-63 chars, a-z 0-9 hyphens) plus .402bot.eth, .402api.eth or .402mcp.eth, e.g. mybot.402bot.eth",
              },
            },
            required: ["name"],
          },
          output: {
            example: outputExample,
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                available: { type: "boolean" },
                mintFee: {
                  type: "object",
                  properties: { wei: { type: "string" }, eth: { type: "string" } },
                },
                registerUrl: { type: "string" },
                message: { type: "string" },
              },
              required: ["name", "available", "registerUrl", "message"],
            },
          },
        }),
      },
    },
  };
}

// One middleware per isolate — the facilitator client syncs /supported once.
let payment: ReturnType<typeof paymentMiddleware> | undefined;
function getPayment(env: Env) {
  if (!payment) {
    const test = env.TEST_FACILITATOR_URL;
    const network = test ? BASE_SEPOLIA : BASE;
    const facilitator = new HTTPFacilitatorClient(
      test ? { url: test } : createFacilitatorConfig(env.CDP_API_KEY_ID, env.CDP_API_KEY_SECRET),
    );
    const server = new x402ResourceServer(facilitator).register(network, new ExactEvmScheme());
    payment = paymentMiddleware(routes(network), server);
  }
  return payment;
}

function client(env: Env) {
  const transports = [
    ...(env.MAINNET_RPC_URL ? [http(env.MAINNET_RPC_URL)] : []),
    http("https://ethereum-rpc.publicnode.com"),
    http("https://eth.llamarpc.com"),
  ];
  return createPublicClient({ chain: mainnet, transport: fallback(transports) });
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: "*", exposeHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE", "EXTENSION-RESPONSES"] }));

// Free — what this service is, for humans and agents that land on the root.
app.get("/", (c) =>
  c.json({
    service: "x402 Identity Hub — name availability",
    description: "ENS identity names for AI agents, APIs and MCP servers: *.402bot.eth, *.402api.eth, *.402mcp.eth.",
    endpoint: `GET ${ROUTE}`,
    price: `${PRICE} USDC on Base (x402)`,
    example: `${c.env.PUBLIC_URL.replace(/\/$/, "")}/v1/availability/mybot.402bot.eth`,
    registerUrl: SITE,
  }),
);

// Reject malformed names BEFORE the paywall, so nobody pays for a 400.
app.use("/v1/availability/:name", async (c, next) => {
  const parsed = parseName(c.req.param("name"));
  if ("error" in parsed) return c.json({ error: parsed.error, registerUrl: SITE }, 400);
  return next();
});

app.use("/v1/availability/:name", (c, next) => getPayment(c.env)(c, next));

app.get("/v1/availability/:name", async (c) => {
  const parsed = parseName(c.req.param("name"));
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { label, parent } = parsed;
  const name = `${label}.${parent}`;

  let available: boolean;
  let fee: bigint;
  try {
    const pc = client(c.env);
    [available, fee] = await Promise.all([
      pc.readContract({ address: REGISTRAR, abi: registrarAbi, functionName: "isAvailable", args: [namehash(parent), label] }),
      pc.readContract({ address: REGISTRAR, abi: registrarAbi, functionName: "mintFee" }),
    ]);
  } catch (e) {
    // >= 400, so the payment is not settled.
    console.error("chain read failed", e);
    return c.json({ error: "Could not read Ethereum mainnet right now — you were not charged. Try again." }, 502);
  }

  const eth = formatEther(fee);
  return c.json({
    name,
    available,
    mintFee: { wei: fee.toString(), eth },
    registerUrl: SITE,
    message: available
      ? `${name} is available. Register it at ${SITE} for ${eth} ETH plus gas (Ethereum mainnet).`
      : `${name} is already registered. Other names are available at ${SITE}`,
  });
});

export default app;
