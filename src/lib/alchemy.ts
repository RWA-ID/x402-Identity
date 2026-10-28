// The browser's Alchemy key: on the paid account and allowlisted to our domains,
// so it answers only pages served from them. Node scripts and Hardhat keep
// NEXT_PUBLIC_ALCHEMY_MAINNET / _BASE, since an allowlisted key rejects a request
// with no Origin. Those are never read here, so they stay out of the bundle.
const SITE_KEY = process.env.NEXT_PUBLIC_ALCHEMY_SITE_KEY;

/** Mainnet JSON-RPC for the browser, or undefined to fall back to a public RPC. */
export const SITE_MAINNET_RPC = SITE_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${SITE_KEY}` : undefined;

/** Base JSON-RPC for the browser, or undefined to fall back to a public RPC. */
export const SITE_BASE_RPC = SITE_KEY ? `https://base-mainnet.g.alchemy.com/v2/${SITE_KEY}` : undefined;

/** Alchemy NFT API v3 base for mainnet, or null without a site key. */
export const SITE_NFT_API = SITE_KEY ? `https://eth-mainnet.g.alchemy.com/nft/v3/${SITE_KEY}` : null;
