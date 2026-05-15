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
} from "@x402id/widget-core";
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

  theme?: "light" | "dark";
  blockExplorerUrl?: string;
  onSuccess?: (label: string, parentNode: Hex, txHash: Hex) => void;
}

type Stage = "input" | "confirm" | "submitting" | "success" | "error";

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
        props.walletClient ?? makeInjectedWalletClient(props.chain);
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
      setStage("success");
      props.onSuccess?.(label, parent.node, hash);
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "Transaction failed");
      setStage("error");
    }
  }

  const theme = props.theme ?? "light";
  const fullName = label ? `${label}.${parent.label}` : "";

  return (
    <div className="x402id-root" data-theme={theme}>
      <div className="x402id-h">Claim an x402 identity</div>

      {stage !== "success" && (
        <>
          <div className="x402id-row">
            <input
              className="x402id-input"
              placeholder="yourname"
              value={label}
              onChange={(e) => setLabel(e.target.value.toLowerCase().trim())}
              disabled={stage === "submitting"}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <select
              className="x402id-select"
              value={parent.label}
              onChange={(e) => {
                const next = props.parents.find((p) => p.label === e.target.value);
                if (next) setParent(next);
              }}
              disabled={stage === "submitting"}
            >
              {props.parents.map((p) => (
                <option key={p.label} value={p.label}>.{p.label}</option>
              ))}
            </select>
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

          {!account ? (
            <button
              className="x402id-btn"
              onClick={handleConnect}
              disabled={!hasInjectedWallet()}
            >
              {hasInjectedWallet() ? "Connect wallet" : "No wallet detected"}
            </button>
          ) : (
            <button
              className="x402id-btn"
              onClick={handleRegister}
              disabled={!canProceed || stage === "submitting"}
            >
              {stage === "submitting" ? "Confirm in wallet…" : `Register ${fullName || "subname"}`}
            </button>
          )}
        </>
      )}

      {stage === "success" && txHash && (
        <div>
          <div className="x402id-msg x402id-ok">{fullName} registered.</div>
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
    </div>
  );
}
