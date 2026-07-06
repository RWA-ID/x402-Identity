import { z } from "zod";
import { isAvailable, validateLabel } from "@x402identity/widget-core";
import { PARENTS, REGISTRAR, FORWARDER, parentNodeOf } from "../chain.js";
import { jsonResult, errorResult } from "../result.js";
export function registerAvailabilityTool(server, ctx) {
    server.registerTool("check_availability", {
        description: "Check whether an ENS subname label is valid and available under one of the x402 " +
            "identity parents (402bot.eth for autonomous agents, 402api.eth for API-facing " +
            "services, 402mcp.eth for MCP servers). Call this before register_subname.",
        inputSchema: {
            label: z
                .string()
                .describe("The subname label, e.g. 'myagent' for myagent.402bot.eth"),
            parent: z.enum(PARENTS).describe("Parent name to mint under"),
        },
    }, async ({ label, parent }) => {
        const normalized = label.toLowerCase().trim();
        const invalid = validateLabel(normalized);
        if (invalid) {
            return jsonResult({ name: `${normalized}.${parent}`, available: false, reason: invalid });
        }
        try {
            const available = await isAvailable({ registrar: REGISTRAR, forwarder: FORWARDER, publicClient: ctx.publicClient }, parentNodeOf(parent), normalized);
            return jsonResult({
                name: `${normalized}.${parent}`,
                available,
                ...(available ? {} : { reason: "Already registered" }),
            });
        }
        catch (err) {
            return errorResult(`Availability check failed: ${err.message}`);
        }
    });
}
//# sourceMappingURL=availability.js.map