import { z } from "zod";
import { formatEther } from "viem";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMintFee } from "@x402identity/widget-core";
import { REGISTRAR, FORWARDER, MAX_BATCH, type Ctx } from "../chain.js";
import { jsonResult, errorResult } from "../result.js";

export function registerPriceTool(server: McpServer, ctx: Ctx) {
  server.registerTool(
    "get_price",
    {
      description:
        "Get the total ETH cost to mint one or more x402 identity subnames. " +
        "Includes the protocol mint fee and, if this server is configured with a " +
        "platform fee, that fee as a separate line item.",
      inputSchema: {
        count: z
          .number()
          .int()
          .min(1)
          .max(MAX_BATCH)
          .default(1)
          .describe(`Number of names to mint (max ${MAX_BATCH} per transaction)`),
      },
    },
    async ({ count }) => {
      try {
        const cfg = { registrar: REGISTRAR, forwarder: FORWARDER, publicClient: ctx.publicClient };
        const mintFee = await getMintFee(cfg);
        const platformFee = ctx.platform?.feeWei ?? 0n;
        const total = (mintFee + platformFee) * BigInt(count);
        return jsonResult({
          count,
          protocolFeePerNameWei: mintFee,
          protocolFeePerNameEth: formatEther(mintFee),
          platformFeePerNameWei: platformFee,
          totalWei: total,
          totalEth: formatEther(total),
          note: "Plus gas. Excess ETH sent above the fee is refunded by the contract.",
        });
      } catch (err) {
        return errorResult(`Price lookup failed: ${(err as Error).message}`);
      }
    },
  );
}
