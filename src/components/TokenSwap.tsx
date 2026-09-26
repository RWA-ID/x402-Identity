"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, useReadContract, useSwitchChain, useConfig } from "wagmi";
import { sendTransaction, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { base } from "wagmi/chains";
import { useAppKit } from "@reown/appkit/react";
import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import { TOKEN, SWAP_API, ERC20_ABI } from "@/lib/token";

type Side = "buy" | "sell";

type ZeroExFee = { amount: string; token: string } | null;
type ZeroExResponse = {
  liquidityAvailable?: boolean;
  buyAmount?: string;
  minBuyAmount?: string;
  fees?: { integratorFee: ZeroExFee; zeroExFee: ZeroExFee };
  issues?: { allowance: { spender: Address; actual: string } | null };
  transaction?: { to: Address; data: Hex; value: string; gas: string | null };
  message?: string;
  error?: string;
};

// Placeholder taker for indicative prices before a wallet connects.
const PRICE_TAKER = TOKEN.treasury;

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const precise = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

function fmt(wei: bigint | string | undefined, big = false) {
  if (wei === undefined) return "—";
  const n = Number(formatUnits(BigInt(wei), 18));
  return big ? compact.format(n) : precise.format(n);
}

async function callSwapApi(endpoint: "price" | "quote", side: Side, amount: bigint, taker: Address) {
  const qs = new URLSearchParams({ side, amount: amount.toString(), taker });
  const res = await fetch(`${SWAP_API}/${endpoint}?${qs}`);
  return (await res.json()) as ZeroExResponse;
}

export function TokenSwap() {
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { open } = useAppKit();

  const [side, setSide] = useState<Side>("buy");
  const [input, setInput] = useState("");
  const [price, setPrice] = useState<ZeroExResponse | null>(null);
  const [pricing, setPricing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string; hash?: Hex } | null>(null);

  const ethBal = useBalance({ address, chainId: base.id, query: { enabled: !!address } });
  const tokBal = useReadContract({
    address: TOKEN.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: !!address },
  });

  let amount: bigint | null = null;
  try {
    amount = input && Number(input) > 0 ? parseUnits(input, 18) : null;
  } catch {
    amount = null;
  }

  // Indicative price, debounced.
  useEffect(() => {
    setPrice(null);
    if (!amount) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setPricing(true);
      try {
        const r = await callSwapApi("price", side, amount!, address ?? PRICE_TAKER);
        if (!cancelled) setPrice(r);
      } catch {
        if (!cancelled) setPrice({ error: "Price unavailable — try again." });
      } finally {
        if (!cancelled) setPricing(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, side, address]);

  const balance = side === "buy" ? ethBal.data?.value : (tokBal.data as bigint | undefined);
  const insufficient = amount !== null && balance !== undefined && amount > balance;
  const noLiquidity = price?.liquidityAvailable === false;

  const execute = async () => {
    if (!isConnected || !address) return open();
    if (!amount) return;
    setResult(null);
    try {
      if (chainId !== base.id) {
        setBusy("Switching to Base…");
        await switchChainAsync({ chainId: base.id });
      }

      setBusy("Fetching quote…");
      let quote = await callSwapApi("quote", side, amount, address);

      if (side === "sell" && quote.issues?.allowance) {
        setBusy(`Approve ${TOKEN.symbol} in your wallet…`);
        const approveHash = await writeContract(config, {
          chainId: base.id,
          address: TOKEN.address,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [quote.issues.allowance.spender, amount],
        });
        const approval = await waitForTransactionReceipt(config, { chainId: base.id, hash: approveHash });
        if (approval.status !== "success") throw new Error("Approval reverted.");
        setBusy("Refreshing quote…");
        quote = await callSwapApi("quote", side, amount, address);
      }

      if (!quote.transaction || quote.liquidityAvailable === false) {
        throw new Error(quote.message || quote.error || "No route available right now.");
      }

      setBusy("Confirm the swap in your wallet…");
      const hash = await sendTransaction(config, {
        chainId: base.id,
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: BigInt(quote.transaction.value),
        gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
      });
      setBusy("Confirming on Base…");
      const receipt = await waitForTransactionReceipt(config, { chainId: base.id, hash });
      // waitForTransactionReceipt resolves on revert too — check status explicitly.
      if (receipt.status !== "success") {
        setResult({ ok: false, text: "Swap reverted — no funds moved except gas.", hash });
      } else {
        setResult({ ok: true, text: side === "buy" ? `Bought ${TOKEN.symbol}.` : `Sold ${TOKEN.symbol}.`, hash });
        setInput("");
      }
      ethBal.refetch();
      tokBal.refetch();
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string }).shortMessage || (e as Error).message;
      setResult({ ok: false, text: /reject|denied/i.test(msg) ? "Cancelled in wallet." : msg });
    } finally {
      setBusy(null);
    }
  };

  let cta = side === "buy" ? `Buy ${TOKEN.symbol}` : `Sell ${TOKEN.symbol}`;
  if (!isConnected) cta = "Connect wallet";
  else if (busy) cta = busy;
  else if (insufficient) cta = `Insufficient ${side === "buy" ? "ETH" : TOKEN.symbol} on Base`;
  else if (chainId !== base.id) cta = `Switch to Base & ${side}`;

  const disabled = isConnected && (!!busy || !amount || insufficient || noLiquidity || pricing || !price?.buyAmount);

  return (
    <div className="swap-card">
      <div className="swap-tabs" role="tablist">
        {(["buy", "sell"] as Side[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            className={side === s ? "on" : ""}
            onClick={() => {
              setSide(s);
              setInput("");
              setResult(null);
            }}
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
        <span className="swap-chain mono">Base</span>
      </div>

      <label className="swap-field">
        <span className="swap-label mono">
          You pay
          {address && (
            <button
              className="swap-max mono"
              onClick={() => balance !== undefined && setInput(formatUnits(balance, 18))}
              type="button"
            >
              Bal {fmt(balance, side === "sell")}
            </button>
          )}
        </span>
        <div className="swap-input">
          <input
            inputMode="decimal"
            placeholder="0.0"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <span className="mono">{side === "buy" ? "ETH" : TOKEN.symbol}</span>
        </div>
      </label>

      <div className="swap-field">
        <span className="swap-label mono">You receive (est.)</span>
        <div className="swap-input swap-out">
          <span className="swap-out-v">
            {pricing ? "…" : price?.buyAmount ? fmt(price.buyAmount, side === "buy") : "0.0"}
          </span>
          <span className="mono">{side === "buy" ? TOKEN.symbol : "ETH"}</span>
        </div>
      </div>

      {noLiquidity && (
        <p className="swap-note">
          {side === "sell"
            ? "No sell route yet — the pool only holds ETH once people have bought. Try again shortly."
            : "No route right now. Try a different amount."}
        </p>
      )}
      {price?.error && <p className="swap-note">{price.error}</p>}

      {price?.buyAmount && (
        <dl className="swap-meta mono">
          <div><dt>Minimum received</dt><dd>{fmt(price.minBuyAmount, side === "buy")} {side === "buy" ? TOKEN.symbol : "ETH"}</dd></div>
          <div><dt>Route</dt><dd>Uniswap v4 · 1% max slippage</dd></div>
          <div><dt>x402 fee</dt><dd>{TOKEN.swapFeePct} → treasury</dd></div>
          <div><dt>0x fee</dt><dd>0.15%</dd></div>
        </dl>
      )}

      <button className="btn btn-primary btn-lg swap-cta" disabled={disabled} onClick={execute}>
        {cta}
      </button>

      {result && (
        <p className={`swap-result ${result.ok ? "ok" : "err"}`}>
          {result.text}{" "}
          {result.hash && (
            <a href={`https://basescan.org/tx/${result.hash}`} target="_blank" rel="noopener">
              View on Basescan ↗
            </a>
          )}
        </p>
      )}

      <p className="swap-fine">
        Quotes via 0x · pool fee 1.75% applies on every trade. Swaps settle on Base; minting names stays
        on Ethereum mainnet.
      </p>
    </div>
  );
}
