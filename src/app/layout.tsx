"use client";

import "./globals.css";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { WalletConnectErrorBoundary } from "@/components/WalletConnectErrorBoundary";
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
        <meta name="theme-color" content="#f97316" />
      </head>
      <body className="antialiased">
        <WalletConnectErrorBoundary>
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </WagmiProvider>
        </WalletConnectErrorBoundary>
      </body>
    </html>
  );
}
