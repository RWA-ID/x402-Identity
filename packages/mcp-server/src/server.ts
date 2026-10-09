import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Ctx } from "./chain.js";
import { registerAvailabilityTool } from "./tools/availability.js";
import { registerPriceTool } from "./tools/price.js";
import { registerRegisterTools } from "./tools/register.js";
import { registerIdentityTools } from "./tools/identity.js";
import { registerPayeeTool } from "./tools/payee.js";

export function buildServer(ctx: Ctx): McpServer {
  const server = new McpServer({
    name: "x402-identity-hub",
    version: "0.2.0",
  });

  registerAvailabilityTool(server, ctx);
  registerPriceTool(server, ctx);
  registerRegisterTools(server, ctx);
  registerIdentityTools(server, ctx);
  registerPayeeTool(server, ctx);

  return server;
}
