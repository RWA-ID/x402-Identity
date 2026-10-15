// /.well-known/x402: the host manifest from the `discovery` extension
// (x402#2979, draft-hawkins-x402-dns-discovery), the shape ~770 x402 hosts
// already serve. Indexers read `resources` and probe each URL for the live 402.
//
// `extensions["payee-name"]` is ours (specs/extensions/payee-name.md): the
// same pointer the 402 carries, so a client can check who is behind payTo
// before it ever requests a resource. #2979 says unknown fields MUST be
// ignored, so a consumer that doesn't know it loses nothing.

export type ManifestOptions = {
  /** Origin the manifest is served from. #2979: every resource URL MUST be on it. */
  origin: string;
  /** Facilitator base URL this host routes payments through (a pointer, not a capability block). */
  facilitator: string;
  /** Paid resources on this origin, as paths. */
  resources: { path: string; method: string }[];
  /** ENS payee name, or omit when the name doesn't cover this network (test mode). */
  payeeName?: string;
};

export function x402Manifest({ origin, facilitator, resources, payeeName }: ManifestOptions) {
  const base = new URL(origin);
  return {
    x402Version: 2,
    kind: "resource-server",
    facilitator,
    // Bare pointers: url + method only. #2979 forbids a partially populated
    // entry, and the price lives in the live 402, which always wins.
    resources: resources.map(({ path, method }) => ({ url: new URL(path, base).toString(), method })),
    ...(payeeName ? { extensions: { "payee-name": { info: { name: payeeName } } } } : {}),
  };
}
