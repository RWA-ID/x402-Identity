"use client";

import { useState } from "react";

const FORWARDER = "0x05af104ce913e7ef39799bfada871817d3761778";
const REGISTRAR = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";

const SNIPPET_HTML = `<!-- 1. Container where the widget will mount -->
<div data-x402id
     data-treasury="0xYourPlatformTreasury"
     data-platform-fee-wei="1000000000000000"
     data-parents="402bot.eth,402api.eth,402mcp.eth"
     data-theme="light"></div>

<!-- 2. Loader script -->
<script src="https://x402id.eth.link/embed.js" async></script>`;

const SNIPPET_REACT = `import { X402Widget } from "@x402identity/widget-react";
import { mainnet } from "viem/chains";
import { namehash, parseEther } from "viem";

<X402Widget
  registrar="${REGISTRAR}"
  forwarder="${FORWARDER}"
  parents={[
    { label: "402bot.eth", node: namehash("402bot.eth") },
    { label: "402api.eth", node: namehash("402api.eth") },
    { label: "402mcp.eth", node: namehash("402mcp.eth") },
  ]}
  platformTreasury="0xYourPlatformTreasury"
  platformFeeWei={parseEther("0.001")}
  chain={mainnet}
  theme="light"
  onSuccess={(label, parentNode, txHash) => console.log("minted", label, txHash)}
/>`;

function Code({ id, code }: { id: string; code: string }) {
  const [label, setLabel] = useState("Copy");
  return (
    <div className="code-block">
      <button
        className="btn btn-ghost"
        style={{ position: "absolute", top: 12, right: 12, height: 32, padding: "0 12px", fontSize: 12 }}
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setLabel("Copied");
          setTimeout(() => setLabel("Copy"), 1200);
        }}
      >
        {label}
      </button>
      <pre id={id} style={{ margin: 0, padding: "20px 24px", overflow: "auto", fontSize: 13, lineHeight: 1.55 }}>
        <code className="mono">{code}</code>
      </pre>
    </div>
  );
}

export default function IntegratePage() {
  return (
    <main>
      <section style={{ padding: "80px 0 40px" }}>
        <div className="wrap">
          <div className="eyebrow">Integrate</div>
          <h1 style={{ maxWidth: "20ch", marginTop: 16 }}>Earn from x402 registrations on your platform.</h1>
          <p className="lede" style={{ maxWidth: "60ch", marginTop: 24 }}>
            Drop the x402id widget into your site and set your own platform fee. Users get a permanent ENS
            subname under <span className="mono">402bot.eth</span>, <span className="mono">402api.eth</span>,
            or <span className="mono">402mcp.eth</span>. You and the protocol get paid atomically in the same
            transaction.
          </p>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "48px 0" }}>
        <div className="wrap">
          <h2>How the fees work</h2>
          <p style={{ marginTop: 16, maxWidth: "60ch", color: "var(--muted)" }}>
            Each registration pays a protocol fee (currently <span className="mono">0.005 ETH</span>) plus a
            platform fee that you choose. The widget shows users the breakdown line-by-line before they sign —
            no hidden charges. Both legs settle in one transaction through the forwarder contract.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 24 }}>
            <div style={{ padding: 20, border: "1px solid var(--line)", borderRadius: 12 }}>
              <div className="eyebrow">Protocol fee</div>
              <div style={{ fontSize: 22, marginTop: 8 }} className="mono">0.005 ETH</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>set on-chain by the registrar</div>
            </div>
            <div style={{ padding: 20, border: "1px solid var(--line)", borderRadius: 12 }}>
              <div className="eyebrow">Your platform fee</div>
              <div style={{ fontSize: 22, marginTop: 8 }} className="mono">you choose</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>capped at 0.05 ETH</div>
            </div>
            <div style={{ padding: 20, border: "1px solid var(--line)", borderRadius: 12 }}>
              <div className="eyebrow">Settlement</div>
              <div style={{ fontSize: 22, marginTop: 8 }} className="mono">1 tx</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>atomic, no relayer or backend</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "48px 0" }}>
        <div className="wrap">
          <h2>1. Drop-in for any site</h2>
          <p style={{ marginTop: 16, maxWidth: "60ch", color: "var(--muted)" }}>
            Paste the snippet anywhere — WordPress, plain HTML, Webflow, anywhere a <span className="mono">&lt;script&gt;</span> tag
            works. The loader mounts an iframe pointed at the hosted widget.
          </p>
          <div style={{ marginTop: 20, position: "relative", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--bg-sunk)" }}>
            <Code id="embed-html" code={SNIPPET_HTML} />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
            <strong>Data attributes:</strong>{" "}
            <span className="mono">data-treasury</span> (your address, required),{" "}
            <span className="mono">data-platform-fee-wei</span> (in wei),{" "}
            <span className="mono">data-parents</span> (subset of supported parents),{" "}
            <span className="mono">data-theme</span> (<span className="mono">light</span> or <span className="mono">dark</span>).
          </p>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "48px 0" }}>
        <div className="wrap">
          <h2>2. React / Next.js</h2>
          <p style={{ marginTop: 16, maxWidth: "60ch", color: "var(--muted)" }}>
            For React apps, install the package and render the component. It uses your existing wagmi/viem
            context if present, or falls back to <span className="mono">window.ethereum</span>.
          </p>
          <div style={{ marginTop: 16, padding: "12px 18px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-sunk)" }}>
            <code className="mono" style={{ fontSize: 13 }}>npm install @x402identity/widget-react viem</code>
          </div>
          <div style={{ marginTop: 16, position: "relative", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--bg-sunk)" }}>
            <Code id="embed-react" code={SNIPPET_REACT} />
          </div>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "48px 0" }}>
        <div className="wrap">
          <h2>Contracts</h2>
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div style={{ padding: 20, border: "1px solid var(--line)", borderRadius: 12 }}>
              <div className="eyebrow">Forwarder (entry point)</div>
              <a
                className="mono"
                style={{ display: "block", marginTop: 8, fontSize: 13, wordBreak: "break-all", color: "inherit" }}
                href={`https://etherscan.io/address/${FORWARDER}`}
                target="_blank"
                rel="noreferrer"
              >
                {FORWARDER}
              </a>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                Splits payment between protocol and your treasury. The widget calls this — you don&apos;t need to
                interact with it directly.
              </p>
            </div>
            <div style={{ padding: 20, border: "1px solid var(--line)", borderRadius: 12 }}>
              <div className="eyebrow">Registrar</div>
              <a
                className="mono"
                style={{ display: "block", marginTop: 8, fontSize: 13, wordBreak: "break-all", color: "inherit" }}
                href={`https://etherscan.io/address/${REGISTRAR}`}
                target="_blank"
                rel="noreferrer"
              >
                {REGISTRAR}
              </a>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                Mints the subname under the chosen parent. Holds the protocol fee.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "48px 0 96px" }}>
        <div className="wrap">
          <h2>Live demo</h2>
          <p style={{ marginTop: 16, maxWidth: "60ch", color: "var(--muted)" }}>
            See the widget in action with adjustable theme and platform fee — it&apos;s wired to the same mainnet
            forwarder you&apos;d ship.
          </p>
          <a href="/widget-demo/" className="btn btn-primary btn-lg" style={{ marginTop: 20, display: "inline-flex" }}>
            Open demo <span className="arrow">→</span>
          </a>
        </div>
      </section>
    </main>
  );
}
