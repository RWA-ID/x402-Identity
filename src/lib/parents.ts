import { namehash } from "viem/ens";

export const PARENTS = [
  {
    id: "402bot",
    label: "402bot.eth",
    node: namehash("402bot.eth"),
    display: "402bot",
    suffix: ".eth",
    description: "AI agent bots & automation",
    icon: "/icon-bot.png",
    color: "#f97316",
  },
  {
    id: "402api",
    label: "402api.eth",
    node: namehash("402api.eth"),
    display: "402api",
    suffix: ".eth",
    description: "API endpoints & services",
    icon: "/icon-api.png",
    color: "#fb923c",
  },
  {
    id: "402mcp",
    label: "402mcp.eth",
    node: namehash("402mcp.eth"),
    display: "402mcp",
    suffix: ".eth",
    description: "MCP protocol integrations",
    icon: "/icon-mcp.png",
    color: "#fdba74",
  },
] as const;

export type ParentId = (typeof PARENTS)[number]["id"];
export type Parent = (typeof PARENTS)[number];
