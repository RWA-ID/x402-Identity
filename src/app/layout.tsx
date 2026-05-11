"use client";

import "./globals.css";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiAdapter } from "@/lib/wagmi";
import { useState } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <head>
        <title>x402 Identity Hub</title>
        <meta
          name="description"
          content="Mint ENS subnames under 402bot.eth, 402api.eth, 402mcp.eth — your AI agent identity onchain."
        />
        <meta property="og:title" content="x402 Identity Hub" />
        <meta property="og:description" content="Mint permanent ENS subnames for your AI agents." />
        <meta name="theme-color" content="#0080BC" />
        <meta name="google-site-verification" content="OtVg0C9NspzC28KBeFogk7gNEoAaVdJrJiPxoa7JuxY" />
        <meta name="keywords" content="x402, x402 identity, ENS subnames, AI agent identity, 402bot, 402api, 402mcp, onchain identity, ENS, Ethereum Name Service, AI agent ENS, x402 protocol, web3 identity" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://x402id.eth.link/" />
        <meta property="og:image" content="https://x402id.eth.link/icon-bot.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="x402 Identity Hub" />
        <meta name="twitter:description" content="Mint permanent ENS subnames for your AI agents under 402bot.eth, 402api.eth, 402mcp.eth." />
        <link rel="canonical" href="https://x402id.eth.link/" />
      </head>
      <body className="antialiased">
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
