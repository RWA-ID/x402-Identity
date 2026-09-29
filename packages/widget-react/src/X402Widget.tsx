import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
  formatEther,
} from "viem";
import {
  getMintFee,
  getMaxPlatformFee,
  isAvailable,
  registerVia,
  validateLabel,
  subnameNode,
  getResolver,
  setAddress,
  getLowFees,
} from "@x402identity/widget-core";
import { injectStyles } from "./styles.js";
import {
  connectInjected,
  hasInjectedWallet,
  makeInjectedWalletClient,
  makePublicClient,
} from "./wallet.js";

export interface ParentOption {
  /** Display label, e.g. "402bot.eth" */
  label: string;
  /** namehash of the parent */
  node: Hex;
  /** Short caption under the namespace button, e.g. "Agents". Defaults by label. */
  description?: string;
}

export const X402_THEMES = ["light", "dark", "lime", "orange", "purple"] as const;
export type X402Theme = (typeof X402_THEMES)[number];

const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  "402bot.eth": "Agents",
  "402api.eth": "Services",
  "402mcp.eth": "MCP servers",
};

function Logo() {
  return (
    // width/height attrs: the stylesheet is injected in an effect, after first paint.
    <svg className="x402id-logo" viewBox="0 0 64 64" width="36" height="36" aria-hidden="true">
      <defs>
        <linearGradient id="x402id-logo-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FAFBFC" />
          <stop offset=".35" stopColor="#E3E6E9" />
          <stop offset=".6" stopColor="#CDD1D6" />
          <stop offset=".85" stopColor="#E9EBEE" />
          <stop offset="1" stopColor="#F4F5F7" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="14" fill="url(#x402id-logo-silver)" stroke="#AEB4BB" strokeWidth="1.2" />
      <rect x="2.5" y="2.5" width="59" height="59" rx="12.5" fill="none" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="1" />
      <g stroke="#0A0B0D" strokeWidth="7" strokeLinecap="round">
        <line x1="18" y1="18" x2="26.5" y2="26.5" />
        <line x1="46" y1="18" x2="37.5" y2="26.5" />
        <line x1="18" y1="46" x2="26.5" y2="37.5" />
        <line x1="46" y1="46" x2="37.5" y2="37.5" />
      </g>
      <polygon points="32,25.5 38.5,32 32,38.5 25.5,32" fill="#0080BC" />
    </svg>
  );
}

export interface X402WidgetProps {
  registrar: Address;
  forwarder: Address;
  parents: ParentOption[];
  platformTreasury: Address;
  platformFeeWei: bigint;

  chain: Chain;
  rpcUrl?: string;

  /** Optionally pass viem clients from host (e.g. wagmi). */
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  /** Connected account. If omitted, widget exposes its own connect UI. */
  account?: Address;
  /**
   * Host connect handler, e.g. `() => open()` from AppKit or RainbowKit's
   * `openConnectModal`. When set, the widget's Connect button calls it instead of
   * `window.ethereum`, stays enabled without an injected wallet, and never falls
   * back to an injected wallet client — the host passes `account` + `walletClient`.
   */
  onConnect?: () => void;

  theme?: X402Theme;
  blockExplorerUrl?: string;
  onSuccess?: (label: string, parentNode: Hex, txHash: Hex) => void;
}

type Stage = "input" | "confirm" | "submitting" | "confirming" | "success" | "error";
type Link = "idle" | "signing" | "confirming" | "linked" | "failed";

export function X402Widget(props: X402WidgetProps) {
  useEffect(() => injectStyles(), []);

  const pub = useMemo<PublicClient>(
    () => props.publicClient ?? makePublicClient(props.chain, props.rpcUrl),
    [props.publicClient, props.chain, props.rpcUrl],
  );

  const [parent, setParent] = useState<ParentOption>(props.parents[0]);
  const [label, setLabel] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [availability, setAvailability] = useState<"idle" | "checking" | "free" | "taken">("idle");
  const [error, setError] = useState<string | null>(null);
  const [protocolFee, setProtocolFee] = useState<bigint | null>(null);
  const [maxFee, setMaxFee] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [link, setLink] = useState<Link>("idle");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [account, setAccount] = useState<Address | undefined>(props.account);
  useEffect(() => setAccount(props.account), [props.account]);

  // Load fees up front.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [pf, mf] = await Promise.all([
          getMintFee({ registrar: props.registrar, forwarder: props.forwarder, publicClient: pub }),
          getMaxPlatformFee({ registrar: props.registrar, forwarder: props.forwarder, publicClient: pub }),
        ]);
        if (cancel) return;
        setProtocolFee(pf);
        setMaxFee(mf);
      } catch (e: any) {
        if (!cancel) setError(e?.shortMessage ?? e?.message ?? "Failed to load fees");
      }
    })();
    return () => { cancel = true; };
  }, [pub, props.registrar, props.forwarder]);

  // Debounced availability check.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setError(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (!label) { setAvailability("idle"); return; }
    const err = validateLabel(label);
    if (err) { setAvailability("idle"); setError(err); return; }
    setAvailability("checking");
    debounce.current = setTimeout(async () => {
      try {
        const ok = await isAvailable(
          { registrar: props.registrar, forwarder: props.forwarder, publicClient: pub },
          parent.node,
          label,
        );
        setAvailability(ok ? "free" : "taken");
      } catch (e: any) {
        setError(e?.shortMessage ?? e?.message ?? "Lookup failed");
        setAvailability("idle");
      }
    }, 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [label, parent.node, pub, props.registrar, props.forwarder]);

  const overCap = maxFee != null && props.platformFeeWei > maxFee;
  const total = (protocolFee ?? 0n) + props.platformFeeWei;
  const canProceed =
    availability === "free" &&
    !error &&
    !overCap &&
    protocolFee != null;

  async function handleConnect() {
    setError(null);
    if (props.onConnect) { props.onConnect(); return; }
    try {
      const a = await connectInjected();
      if (a) setAccount(a);
      else setError("No wallet detected");
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "Connect failed");
    }
  }

  async function handleRegister() {
    if (!account) { await handleConnect(); return; }
    setError(null);
    setStage("submitting");
    try {
      const wallet =
        props.walletClient ?? (props.onConnect ? null : makeInjectedWalletClient(props.chain));
      if (!wallet) throw new Error("No wallet client available");
      const hash = await registerVia(
        { registrar: props.registrar, forwarder: props.forwarder, publicClient: pub },
        wallet,
        {
          parentNode: parent.node,
          label,
          platformTreasury: props.platformTreasury,
          platformFee: props.platformFeeWei,
          user: account,
        },
      );
      setTxHash(hash);
      setStage("confirming");
      // waitForTransactionReceipt resolves on a revert too — check the status.
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Registration reverted");
      setStage("success");
      props.onSuccess?.(label, parent.node, hash);
      void handleSetAddress(account);
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "Transaction failed");
      setStage("error");
    }
  }

  // Minting writes no address record, so a fresh name resolves to 0x0.
  // Point its ETH and Base records at the minter in one multicall.
  async function handleSetAddress(user: Address | undefined = account) {
    if (!user) return;
    setLinkError(null);
    setLink("signing");
    try {
      const wallet = props.walletClient ?? (props.onConnect ? null : makeInjectedWalletClient(props.chain));
      if (!wallet) throw new Error("No wallet client available");
      const node = subnameNode(parent.node, label);
      const [resolver, fees] = await Promise.all([getResolver(pub, `${label}.${parent.label}`), getLowFees(pub)]);
      const hash = await setAddress(wallet, { resolver, nodes: [node], address: user, account: user, fees });
      setLink("confirming");
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Set address reverted");
      setLink("linked");
    } catch (e: any) {
      setLinkError(e?.shortMessage ?? e?.message ?? "Set address failed");
      setLink("failed");
    }
  }

  const theme: X402Theme = (X402_THEMES as readonly string[]).includes(props.theme ?? "")
    ? (props.theme as X402Theme)
    : "light";
  const fullName = label ? `${label}.${parent.label}` : "";
  const busy = stage === "submitting" || stage === "confirming";

  return (
    <div className="x402id-root" data-theme={theme}>
      <div className="x402id-head">
        <Logo />
        <div>
          <div className="x402id-title">Claim an x402 identity</div>
          <div className="x402id-sub">Permanent ENS subname on Ethereum</div>
        </div>
      </div>

      {stage !== "success" && (
        <>
          {props.parents.length > 1 && (
            <>
              <div className="x402id-label">Namespace</div>
              <div className="x402id-ns" role="radiogroup" aria-label="Namespace">
                {props.parents.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    role="radio"
                    aria-checked={p.label === parent.label}
                    className="x402id-nsopt"
                    onClick={() => setParent(p)}
                    disabled={busy}
                  >
                    <span className="x402id-nsname">.{p.label}</span>
                    <span className="x402id-nsdesc">
                      {p.description ?? DEFAULT_DESCRIPTIONS[p.label] ?? "Subnames"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="x402id-label">Name</div>
          <div className="x402id-field">
            <input
              className="x402id-input"
              placeholder="yourname"
              aria-label="Name"
              value={label}
              onChange={(e) => setLabel(e.target.value.toLowerCase().trim())}
              disabled={busy}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <span className="x402id-suffix">.{parent.label}</span>
          </div>

          <div className={`x402id-msg ${error ? "x402id-err" : availability === "free" ? "x402id-ok" : ""}`}>
            {error
              ? error
              : availability === "checking"
              ? "Checking availability…"
              : availability === "free"
              ? `${fullName} is available`
              : availability === "taken"
              ? `${fullName} is taken`
              : " "}
          </div>

          {protocolFee != null && (
            <div className="x402id-breakdown">
              <div className="x402id-line">
                <span className="x402id-muted">Protocol fee</span>
                <span>{formatEther(protocolFee)} ETH</span>
              </div>
              <div className="x402id-line">
                <span className="x402id-muted">Platform fee</span>
                <span>{formatEther(props.platformFeeWei)} ETH</span>
              </div>
              <div className="x402id-line tot">
                <span>Total</span>
                <span>{formatEther(total)} ETH</span>
              </div>
              {overCap && (
                <div className="x402id-msg x402id-err">
                  Platform fee exceeds protocol cap ({formatEther(maxFee!)} ETH).
                </div>
              )}
            </div>
          )}

          <div className="x402id-msg x402id-muted">
            The wallet you register with becomes this name&apos;s Ethereum and Base address. After the
            mint, confirm one small transaction to set it.
          </div>

          {!account ? (
            <button
              className="x402id-btn"
              onClick={handleConnect}
              disabled={!props.onConnect && !hasInjectedWallet()}
            >
              {props.onConnect || hasInjectedWallet() ? "Connect wallet" : "No wallet detected"}
            </button>
          ) : (
            <button
              className="x402id-btn"
              onClick={handleRegister}
              disabled={!canProceed || busy}
            >
              {stage === "submitting"
                ? "Confirm in wallet…"
                : stage === "confirming"
                ? "Confirming on-chain…"
                : `Register ${fullName || "subname"}`}
            </button>
          )}
        </>
      )}

      {stage === "success" && txHash && (
        <div>
          <div className="x402id-msg x402id-ok">{fullName} registered.</div>
          {link === "linked" ? (
            <div className="x402id-msg x402id-ok">
              {fullName} now resolves to {account?.slice(0, 6)}…{account?.slice(-4)} on Ethereum and Base.
            </div>
          ) : (
            <>
              <div className="x402id-msg">
                Last step: point {fullName} at your wallet so it resolves on Ethereum and Base.
              </div>
              <button
                className="x402id-btn"
                onClick={() => handleSetAddress()}
                disabled={link === "signing" || link === "confirming"}
              >
                {link === "signing"
                  ? "Confirm in wallet…"
                  : link === "confirming"
                  ? "Confirming on-chain…"
                  : "Set my address"}
              </button>
              {linkError && <div className="x402id-msg x402id-err">{linkError}</div>}
            </>
          )}
          {props.blockExplorerUrl && (
            <div className="x402id-msg">
              <a className="x402id-link" target="_blank" rel="noreferrer"
                 href={`${props.blockExplorerUrl.replace(/\/$/, "")}/tx/${txHash}`}>
                View transaction
              </a>
            </div>
          )}
        </div>
      )}

      <div className="x402id-foot">
        Powered by{" "}
        <a href="https://x402id.eth.link" target="_blank" rel="noreferrer">x402 Identity</a>
      </div>
    </div>
  );
}
