"use client";

import { useState } from "react";
import { namehash, parseEther, type Address } from "viem";
import { mainnet } from "viem/chains";
import { X402Widget } from "@x402identity/widget-react";

const FORWARDER: Address = "0x05af104ce913e7ef39799bfada871817d3761778";
const REGISTRAR: Address = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";
const RPC = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET;

const PARENTS = [
  { label: "402bot.eth", node: namehash("402bot.eth") },
  { label: "402api.eth", node: namehash("402api.eth") },
  { label: "402mcp.eth", node: namehash("402mcp.eth") },
] as const;

const DEMO_TREASURY: Address = "0x000000000000000000000000000000000000dEaD";

export default function WidgetDemoPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [feeEth, setFeeEth] = useState("0.001");

  let platformFeeWei = 0n;
  try { platformFeeWei = parseEther(feeEth || "0"); } catch {}

  return (
    <main style={{ minHeight: "100vh", padding: 40, background: theme === "dark" ? "#0b0b0c" : "#fafafa", color: theme === "dark" ? "#f3f4f6" : "#111" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>x402id widget — demo</h1>
        <p style={{ opacity: 0.7, marginBottom: 24 }}>
          Smoke-test of <code>@x402identity/widget-react</code> against the live mainnet forwarder at{" "}
          <a href={`https://etherscan.io/address/${FORWARDER}`} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{FORWARDER.slice(0, 10)}…</a>
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center" }}>
          <label>
            Theme:{" "}
            <select value={theme} onChange={(e) => setTheme(e.target.value === "dark" ? "dark" : "light")}>
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </label>
          <label>
            Platform fee (ETH):{" "}
            <input value={feeEth} onChange={(e) => setFeeEth(e.target.value)} style={{ width: 100 }} />
          </label>
          <span style={{ opacity: 0.6, fontSize: 13 }}>treasury → {DEMO_TREASURY}</span>
        </div>

        <X402Widget
          registrar={REGISTRAR}
          forwarder={FORWARDER}
          parents={[...PARENTS]}
          platformTreasury={DEMO_TREASURY}
          platformFeeWei={platformFeeWei}
          chain={mainnet}
          rpcUrl={RPC}
          theme={theme}
          blockExplorerUrl="https://etherscan.io"
          onSuccess={(label, _node, tx) => console.log("registered", label, tx)}
        />
      </div>
    </main>
  );
}
