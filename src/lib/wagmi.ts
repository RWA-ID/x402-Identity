"use client";

import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "14a7517e58438b8651397de394d4aba9";

const ALCHEMY_MAINNET =
  process.env.NEXT_PUBLIC_ALCHEMY_MAINNET ||
  "https://eth-mainnet.g.alchemy.com/v2/mfe6RJbAFZV4xDgQ0iSaA";
const ALCHEMY_SEPOLIA =
  process.env.NEXT_PUBLIC_ALCHEMY_SEPOLIA ||
  "https://eth-sepolia.g.alchemy.com/v2/mfe6RJbAFZV4xDgQ0iSaA";

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected(),
    walletConnect({ projectId: PROJECT_ID }),
  ],
  transports: {
    [mainnet.id]: http(ALCHEMY_MAINNET),
    [sepolia.id]: http(ALCHEMY_SEPOLIA),
  },
  ssr: false, // static export (IPFS) — no SSR hydration needed
});
