import { z } from "zod";
import { getAddress, namehash } from "viem";
import { normalize } from "viem/ens";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  REGISTRAR,
  FORWARDER,
  NAME_WRAPPER,
  REGISTRAR_FLOOR_BLOCK,
  NODE_TO_PARENT,
  nameWrapperAbi,
  subnameMintedEvent,
  registeredViaEvent,
  type Ctx,
} from "../chain.js";
import { jsonResult, errorResult } from "../result.js";

const TEXT_KEYS = ["description", "url", "avatar", "com.twitter", "com.github"] as const;

export function registerIdentityTools(server: McpServer, ctx: Ctx) {
  server.registerTool(
    "resolve_identity",
    {
      description:
        "Resolve an ENS name (e.g. myagent.402bot.eth) to its Ethereum address, current " +
        "owner, and common text records (description, url, avatar, socials).",
      inputSchema: {
        name: z.string().describe("Full ENS name, e.g. 'myagent.402bot.eth'"),
      },
    },
    async ({ name }) => {
      try {
        const normalized = normalize(name);
        const [address, rawOwner, ...texts] = await Promise.all([
          ctx.publicClient.getEnsAddress({ name: normalized }).catch(() => null),
          ctx.publicClient
            .readContract({
              address: NAME_WRAPPER,
              abi: nameWrapperAbi,
              functionName: "ownerOf",
              args: [BigInt(namehash(normalized))],
            })
            .catch(() => null),
          ...TEXT_KEYS.map((key) =>
            ctx.publicClient.getEnsText({ name: normalized, key }).catch(() => null),
          ),
        ]);

        // NameWrapper returns the zero address for nonexistent names.
        const owner =
          rawOwner && rawOwner !== "0x0000000000000000000000000000000000000000"
            ? rawOwner
            : null;

        const records = Object.fromEntries(
          TEXT_KEYS.map((key, i) => [key, texts[i]]).filter(([, v]) => v),
        );

        if (!address && !owner) {
          return jsonResult({ name: normalized, registered: false });
        }
        return jsonResult({ name: normalized, registered: true, address, owner, records });
      } catch (err) {
        return errorResult(`Resolution failed: ${(err as Error).message}`);
      }
    },
  );

  server.registerTool(
    "list_names",
    {
      description:
        "List all x402 identity subnames (402bot.eth / 402api.eth / 402mcp.eth) ever " +
        "minted by an Ethereum address, from on-chain SubnameMinted events.",
      inputSchema: {
        owner: z.string().describe("Ethereum address (0x…) that minted the names"),
      },
    },
    async ({ owner }) => {
      try {
        const minter = getAddress(owner);
        // Direct mints emit SubnameMinted(minter=user); mints routed through the
        // forwarder emit SubnameMinted(minter=forwarder) — the real user is on the
        // forwarder's RegisteredVia event. Scan both.
        const [direct, viaForwarder] = await Promise.all([
          ctx.publicClient.getLogs({
            address: REGISTRAR,
            event: subnameMintedEvent,
            args: { minter },
            fromBlock: REGISTRAR_FLOOR_BLOCK,
            toBlock: "latest",
          }),
          ctx.publicClient.getLogs({
            address: FORWARDER,
            event: registeredViaEvent,
            args: { user: minter },
            fromBlock: REGISTRAR_FLOOR_BLOCK,
            toBlock: "latest",
          }),
        ]);
        const names = [...direct, ...viaForwarder]
          .map((log) => {
            const parent = NODE_TO_PARENT.get(log.args.parentNode!) ?? "unknown-parent";
            return {
              name: `${log.args.label}.${parent}`,
              mintedAtBlock: log.blockNumber,
              transactionHash: log.transactionHash,
            };
          })
          .sort((a, b) => Number(a.mintedAtBlock - b.mintedAtBlock));
        return jsonResult({ minter, count: names.length, names });
      } catch (err) {
        return errorResult(
          `Name lookup failed: ${(err as Error).message}. If you set a custom X402_RPC_URL, ` +
            "it may cap eth_getLogs ranges — unset it to use the default full-range endpoints.",
        );
      }
    },
  );
}
