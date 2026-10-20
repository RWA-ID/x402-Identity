import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@/components/Analytics";
import { SITE, OG_ALT } from "@/lib/seo";

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
    description: "Onchain identity for x402 agents, verified before every payment.",
    images: [{ url: "/og.png", width: 1200, height: 630, type: "image/png", alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@x402identity",
    creator: "@x402identity",
    title: "x402 Identity Hub",
    description:
      "Onchain identity for x402 agents, verified before every payment. ENS names under 402bot.eth, 402api.eth, 402mcp.eth.",
    images: [{ url: "/og.png", alt: OG_ALT }],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Search Console: the first token verifies the original property, the second x402id.dev.
  verification: {
    google: ["OtVg0C9NspzC28KBeFogk7gNEoAaVdJrJiPxoa7JuxY", "ZwguCvAaW0znvfe7HvVlAme7rj_wzU0QAGcaZ6GKCEY"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0080BC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
