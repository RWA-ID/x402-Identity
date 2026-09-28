"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, base, type AppKitNetwork } from "@reown/appkit/networks";
import { http } from "wagmi";

export const PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "43bdd1b8c477ac4d4a4264a14a8472f8";

// Mainnet hosts the registrar; Base hosts $X402ID and its swap.
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, base];

const ALCHEMY_MAINNET = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET;
const ALCHEMY_BASE = process.env.NEXT_PUBLIC_ALCHEMY_BASE;

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: PROJECT_ID,
  ssr: false,
  transports: {
    [mainnet.id]: ALCHEMY_MAINNET ? http(ALCHEMY_MAINNET) : http(),
    [base.id]: ALCHEMY_BASE ? http(ALCHEMY_BASE) : http(),
  },
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: PROJECT_ID,
  metadata: {
    name: "x402 Identity Hub",
    description: "Mint ENS subnames for AI agents — fully onchain.",
    url: "https://x402id.eth.link",
    // Wallets draw this small and square beside the signing prompt — a square PNG, not .ico/.svg.
    icons: ["https://x402id.eth.link/favicon-512.png"],
  },
  // Email/socials are remote features: the Reown dashboard decides them for the whole
  // project and overrides this block whenever its config fetch succeeds.
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
  // Match the site: light only (nothing sets html[data-theme="dark"]), Inter, blue accent.
  themeMode: "light",
  themeVariables: {
    "--w3m-accent": "#0080BC",
    "--w3m-color-mix": "#FAFAF7",
    "--w3m-color-mix-strength": 20,
    "--w3m-font-family": '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    "--w3m-border-radius-master": "2px",
    "--w3m-z-index": 1000,
  },
});
