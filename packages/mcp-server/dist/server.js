import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAvailabilityTool } from "./tools/availability.js";
import { registerPriceTool } from "./tools/price.js";
import { registerRegisterTools } from "./tools/register.js";
import { registerIdentityTools } from "./tools/identity.js";
export function buildServer(ctx) {
    const server = new McpServer({
        name: "x402-identity-hub",
        version: "0.1.0",
    });
    registerAvailabilityTool(server, ctx);
    registerPriceTool(server, ctx);
    registerRegisterTools(server, ctx);
    registerIdentityTools(server, ctx);
    return server;
}
//# sourceMappingURL=server.js.map