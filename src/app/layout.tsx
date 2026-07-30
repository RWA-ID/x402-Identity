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
        <meta property="og:site_name" content="x402 Identity Hub" />
        <meta property="og:image" content="https://x402id.eth.link/og.png" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="x402 Identity Hub — permanent onchain identity for x402 agents. ENS subnames under 402bot.eth, 402api.eth, and 402mcp.eth." />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@x402identity" />
        <meta name="twitter:creator" content="@x402identity" />
        <meta name="twitter:title" content="x402 Identity Hub" />
        <meta name="twitter:description" content="Mint permanent ENS subnames for your AI agents under 402bot.eth, 402api.eth, 402mcp.eth." />
        <meta name="twitter:image" content="https://x402id.eth.link/og.png" />
        <meta name="twitter:image:alt" content="x402 Identity Hub — permanent onchain identity for x402 agents." />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
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
