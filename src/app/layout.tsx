import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

const SITE = "https://x402id.eth.link";
const OG_ALT =
  "x402 Identity Hub — permanent onchain identity for x402 agents. ENS subnames under 402bot.eth, 402api.eth, and 402mcp.eth.";

// metadataBase lets every page express canonical/og:image as a relative path and
// still emit absolute URLs, which is what scrapers require.
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "x402 Identity Hub",
  description:
    "Mint ENS subnames under 402bot.eth, 402api.eth, 402mcp.eth — your AI agent identity onchain.",
  keywords: [
    "x402",
    "x402 identity",
    "ENS subnames",
    "AI agent identity",
    "402bot",
    "402api",
    "402mcp",
    "onchain identity",
    "ENS",
    "Ethereum Name Service",
    "AI agent ENS",
    "x402 protocol",
    "web3 identity",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "x402 Identity Hub",
    url: "/",
    title: "x402 Identity Hub",
    description: "Mint permanent ENS subnames for your AI agents.",
    images: [{ url: "/og.png", width: 1200, height: 630, type: "image/png", alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@x402identity",
    creator: "@x402identity",
    title: "x402 Identity Hub",
    description:
      "Mint permanent ENS subnames for your AI agents under 402bot.eth, 402api.eth, 402mcp.eth.",
    images: [{ url: "/og.png", alt: OG_ALT }],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  verification: { google: "OtVg0C9NspzC28KBeFogk7gNEoAaVdJrJiPxoa7JuxY" },
};

export const viewport: Viewport = {
  themeColor: "#0080BC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
