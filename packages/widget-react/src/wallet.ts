import {
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "viem";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function getInjected(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  // @ts-expect-error injected by wallet
  return (window.ethereum as Eip1193Provider) ?? null;
}

export function makePublicClient(chain: Chain, rpcUrl?: string): PublicClient {
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

export function makeInjectedWalletClient(chain: Chain): WalletClient | null {
  const eth = getInjected();
  if (!eth) return null;
  return createWalletClient({ chain, transport: custom(eth) });
}

export async function connectInjected(): Promise<Address | null> {
  const eth = getInjected();
  if (!eth) return null;
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  return accounts[0] ?? null;
}

export function hasInjectedWallet(): boolean {
  return getInjected() != null;
}
