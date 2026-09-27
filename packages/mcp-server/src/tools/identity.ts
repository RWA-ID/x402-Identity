import { z } from "zod";
import { getAddress, namehash, zeroAddress } from "viem";
import { normalize, toCoinType } from "viem/ens";
import { base } from "viem/chains";
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
        "Resolve an ENS name (e.g. myagent.402bot.eth) to its Ethereum and Base addresses, " +
        "current owner, and common text records (description, url, avatar, socials). " +
        "Fields that could not be read are listed under `errors` instead of reading as empty.",
      inputSchema: {
        name: z.string().describe("Full ENS name, e.g. 'myagent.402bot.eth'"),
      },
    },
    async ({ name }) => {
      let normalized: string;
      try {
        normalized = normalize(name);
      } catch (err) {
        return errorResult(`Invalid ENS name: ${(err as Error).message}`);
      }

      // viem's ENS actions already return null for a genuinely missing resolver
      // or record, and throw only on a real failure (throttled RPC, network).
      // Catching to null here would publish an outage as "not registered", so
      // each read keeps its error and the result says which fields are unknown.
      const reads = {
        address: () => ctx.publicClient.getEnsAddress({ name: normalized }),
        baseAddress: () =>
          ctx.publicClient.getEnsAddress({ name: normalized, coinType: toCoinType(base.id) }),
        owner: () =>
          ctx.publicClient.readContract({
            address: NAME_WRAPPER,
            abi: nameWrapperAbi,
            functionName: "ownerOf",
            args: [BigInt(namehash(normalized))],
          }),
        ...Object.fromEntries(
          TEXT_KEYS.map((key) => [
            `text:${key}`,
            () => ctx.publicClient.getEnsText({ name: normalized, key }),
          ]),
        ),
      } as Record<string, () => Promise<string | null>>;

      const keys = Object.keys(reads);
      const settled = await Promise.allSettled(keys.map((k) => reads[k]()));
      const value: Record<string, string | null> = {};
      const errors: Record<string, string> = {};
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") value[keys[i]] = r.value;
        else errors[keys[i]] = (r.reason as { shortMessage?: string; message: string })
          .shortMessage ?? (r.reason as Error).message;
      });

      // NameWrapper returns the zero address for nonexistent names.
      const owner = value.owner && value.owner !== zeroAddress ? value.owner : null;
      const records = Object.fromEntries(
        TEXT_KEYS.map((key) => [key, value[`text:${key}`]]).filter(([, v]) => v),
      );

      if (errors.address && errors.owner) {
        return errorResult(
          `Resolution failed for ${normalized}: ${errors.owner.replace(/\.+$/, "")}. The RPC may be ` +
            "throttled — retry, or set X402_RPC_URL to your own endpoint.",
        );
      }

      const registered = Boolean(owner || value.address);
      // A failed read leaves a field unknown, so "not registered" is only
      // claimed when both the owner and address reads actually answered.
      if (!registered && !errors.address && !errors.owner) {
        return jsonResult({ name: normalized, registered: false });
      }
      return jsonResult({
        name: normalized,
        registered: registered ? true : "unknown",
        address: value.address ?? null,
        addresses: {
          ethereum: value.address ?? null,
          base: value.baseAddress ? getAddress(value.baseAddress) : null,
        },
        owner,
        records,
        ...(Object.keys(errors).length ? { errors } : {}),
      });
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
