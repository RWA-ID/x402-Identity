"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, sepolia, type AppKitNetwork } from "@reown/appkit/networks";

export const PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "14a7517e58438b8651397de394d4aba9";

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, sepolia];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: PROJECT_ID,
  ssr: false,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: PROJECT_ID,
  metadata: {
    name: "x402 Identity Hub",
    description: "Mint ENS subnames for AI agents — fully onchain.",
    url: "https://x402id.eth.link",
    icons: ["https://x402id.eth.link/favicon.ico"],
  },
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
  themeMode: "dark",
});
