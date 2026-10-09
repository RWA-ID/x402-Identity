import type { PayeeAccept } from "@x402identity/widget-core";

/** The worker route that reads a 402 for us when the seller's CORS hides it. */
const CHALLENGE_API = "https://x402id-availability.dmpay.workers.dev/v1/challenge";

export type Challenge = {
  url: string;
  /** The origin that answered: the one a payee name must list. */
  origin: string;
  status: number;
  paymentRequired?: boolean;
  readable?: boolean;
  redirect?: string | null;
  accepts?: PayeeAccept[];
  extensions?: Record<string, unknown>;
  /** "browser" when read directly, "worker" when read through CHALLENGE_API. */
  via: "browser" | "worker";
};

function decodeHeader(value: string): { accepts?: unknown; extensions?: unknown } | null {
  try {
    return JSON.parse(atob(value));
  } catch {
    return null;
  }
}

function acceptsOf(raw: unknown): PayeeAccept[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is { network: string; payTo: string } => typeof a?.network === "string" && typeof a?.payTo === "string")
    .map((a) => ({ network: a.network, payTo: a.payTo }));
}

/**
 * Read an endpoint's 402 terms. Tries the browser first. Only about one seller
 * in four exposes PAYMENT-REQUIRED cross-origin, so most reads fall through to
 * the worker, which fetches it server-side without following redirects.
 */
export async function readChallenge(url: string): Promise<Challenge> {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    const header = res.status === 402 ? res.headers.get("payment-required") : null;
    const decoded = header ? decodeHeader(header) : null;
    if (decoded && Array.isArray(decoded.accepts)) {
      const ext = (decoded.extensions && typeof decoded.extensions === "object" ? decoded.extensions : {}) as Record<string, unknown>;
      return {
        url,
        origin: new URL(url).origin,
        status: 402,
        paymentRequired: true,
        readable: true,
        accepts: acceptsOf(decoded.accepts),
        extensions: ext,
        via: "browser",
      };
    }
  } catch {
    // CORS or network: fall through to the worker
  }

  const res = await fetch(`${CHALLENGE_API}?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
  const body = (await res.json()) as Partial<Challenge> & { error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? `Challenge read failed (${res.status})`);
  return { ...(body as Challenge), accepts: acceptsOf(body.accepts), via: "worker" };
}

const NETWORKS: Record<string, string> = {
  "eip155:1": "Ethereum",
  "eip155:8453": "Base",
  "eip155:84532": "Base Sepolia",
  "eip155:10": "Optimism",
  "eip155:42161": "Arbitrum",
  "eip155:137": "Polygon",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana",
};

export function networkLabel(network: string): string {
  return NETWORKS[network] ?? network;
}

export function shortAddr(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
