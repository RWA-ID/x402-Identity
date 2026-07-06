#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildContext } from "./chain.js";
import { buildServer } from "./server.js";

async function main() {
  const ctx = buildContext();
  const server = buildServer(ctx);
  await server.connect(new StdioServerTransport());
  // stdout is the MCP transport — all logging goes to stderr.
  console.error(
    `x402 Identity Hub MCP server ready — mode: ${ctx.wallet ? `wallet (${ctx.wallet.account.address})` : "prepare-only"}` +
      (ctx.platform ? `, platform fee: ${ctx.platform.feeWei} wei → ${ctx.platform.treasury}` : ""),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
