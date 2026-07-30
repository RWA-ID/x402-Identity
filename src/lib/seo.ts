import type { Metadata } from "next";

export const SITE = "https://x402id.eth.link";

export const OG_ALT =
  "x402 Identity Hub — permanent onchain identity for x402 agents. ENS subnames under 402bot.eth, 402api.eth, and 402mcp.eth.";

export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: OG_ALT,
};

/**
 * Build per-page metadata.
 *
 * Next does NOT deep-merge `openGraph`/`twitter` — a page that declares either
 * one replaces the parent's object entirely, silently dropping the inherited
 * `images`. So every page must restate the card image, which is what this does.
 */
export function pageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: `/${string}`;
  index?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "x402 Identity Hub",
      url: path,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      site: "@x402identity",
      creator: "@x402identity",
      title,
      description,
      images: [{ url: OG_IMAGE.url, alt: OG_ALT }],
    },
    ...(index ? {} : { robots: { index: false, follow: false } }),
  };
}
