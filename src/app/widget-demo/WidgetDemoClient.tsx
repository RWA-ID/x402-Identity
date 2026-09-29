"use client";

import { useState } from "react";
import { namehash, parseEther, type Address } from "viem";
import { mainnet } from "viem/chains";
import { X402Widget, type X402Theme } from "@x402identity/widget-react";
import { SiteNav } from "@/components/SiteNav";
import { ChainStrip } from "@/components/ChainStrip";

const FORWARDER: Address = "0x05af104ce913e7ef39799bfada871817d3761778";
const REGISTRAR: Address = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";
const RPC = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET;

const PARENTS = [
  { label: "402bot.eth", desc: "Agents" },
  { label: "402api.eth", desc: "Services" },
  { label: "402mcp.eth", desc: "MCP servers" },
] as const;

const THEMES: { id: X402Theme; name: string; swatch: [string, string] }[] = [
  { id: "light", name: "Light", swatch: ["#ffffff", "#0080bc"] },
  { id: "dark", name: "Dark", swatch: ["#0b0d10", "#1a9ad6"] },
  { id: "lime", name: "Lime", swatch: ["#0c1206", "#a3e635"] },
  { id: "orange", name: "Orange", swatch: ["#fffaf5", "#f97316"] },
  { id: "purple", name: "Purple", swatch: ["#120c1f", "#a78bfa"] },
];

const FEE_PRESETS = ["0", "0.0005", "0.001", "0.005"];

const DEMO_TREASURY: Address = "0x000000000000000000000000000000000000dEaD";

export default function WidgetDemoPage() {
  const [theme, setTheme] = useState<X402Theme>("light");
  const [feeEth, setFeeEth] = useState("0.001");
  const [enabled, setEnabled] = useState<string[]>(PARENTS.map((p) => p.label));
  const [copied, setCopied] = useState(false);

  let platformFeeWei = 0n;
  let feeInvalid = false;
  try { platformFeeWei = parseEther(feeEth || "0"); } catch { feeInvalid = true; }

  const parents = PARENTS.filter((p) => enabled.includes(p.label)).map((p) => ({
    label: p.label,
    node: namehash(p.label),
    description: p.desc,
  }));

  const toggleParent = (label: string) =>
    setEnabled((cur) =>
      cur.includes(label)
        ? cur.length > 1 ? cur.filter((l) => l !== label) : cur
        : PARENTS.map((p) => p.label).filter((l) => l === label || cur.includes(l)),
    );

  const snippet = `<div data-x402id
     data-treasury="0xYourPlatformTreasury"
     data-platform-fee-wei="${platformFeeWei.toString()}"
     data-parents="${enabled.join(",")}"
     data-theme="${theme}"></div>
<script src="https://x402id.eth.link/embed.js" async></script>`;

  return (
    <main className="site">
      <SiteNav
        links={[
          { href: "/", label: "Home" },
          { href: "/#namespaces", label: "Namespaces" },
          { href: "/integrate/", label: "Integrate" },
          { href: "https://www.npmjs.com/package/@x402identity/widget-react", label: "npm" },
        ]}
      />

      <section className="wd-hero">
        <div className="wrap">
          <span className="status">
            <span className="dot" />
            Live on Ethereum mainnet
          </span>
          <h1 className="wd-title">The mint widget, in your colors.</h1>
          <p className="lede" style={{ marginTop: 20 }}>
            Pick a theme, choose which namespaces to offer, and set your platform fee. The preview is the
            real <span className="mono">@x402identity/widget-react</span> component, wired to the live
            forwarder — the embed code below updates as you go.
          </p>
        </div>
      </section>

      <section className="wd-play">
        <div className="wrap wd-grid">
          <div className="wd-controls">
            <div className="wd-group">
              <span className="field-label">Theme</span>
              <div className="wd-themes" role="radiogroup" aria-label="Theme">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={theme === t.id}
                    className={`wd-theme ${theme === t.id ? "active" : ""}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <span
                      className="wd-swatch"
                      style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 0 50%, ${t.swatch[1]} 50% 100%)` }}
                    />
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="wd-group">
              <span className="field-label">Namespaces offered</span>
              <div className="parent-options">
                {PARENTS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={enabled.includes(p.label)}
                    className={`parent-option ${enabled.includes(p.label) ? "active" : ""}`}
                    onClick={() => toggleParent(p.label)}
                  >
                    <span className="name">.{p.label}</span>
                    <span className="desc">{p.desc}</span>
                  </button>
                ))}
              </div>
              <p className="wd-note">At least one stays on. With a single namespace the picker hides.</p>
            </div>

            <div className="wd-group">
              <span className="field-label">Your platform fee</span>
              <div className="wd-fee">
                <input
                  className="label-input"
                  inputMode="decimal"
                  value={feeEth}
                  onChange={(e) => setFeeEth(e.target.value.trim())}
                  aria-label="Platform fee in ETH"
                  aria-invalid={feeInvalid}
                />
                <span className="wd-fee-unit mono">ETH</span>
              </div>
              <div className="wd-presets">
                {FEE_PRESETS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`wd-preset mono ${feeEth === f ? "active" : ""}`}
                    onClick={() => setFeeEth(f)}
                  >
                    {f === "0" ? "none" : f}
                  </button>
                ))}
              </div>
              <p className="wd-note">
                {feeInvalid
                  ? "Enter a number, e.g. 0.001."
                  : "Paid to your treasury in the same transaction. Capped on-chain at 0.05 ETH."}
              </p>
            </div>

            <div className="wd-group">
              <span className="field-label">Demo treasury</span>
              <a
                className="wd-addr mono"
                href={`https://etherscan.io/address/${DEMO_TREASURY}`}
                target="_blank"
                rel="noreferrer"
              >
                {DEMO_TREASURY}
              </a>
              <p className="wd-note">
                Mints on this page are real mainnet mints, and the platform fee goes to this burn address.
                Use your own treasury when you embed it.
              </p>
            </div>
          </div>

          <div className={`wd-stage wd-stage-${theme}`}>
            <div className="wd-stage-bar">
              <span /><span /><span />
              <em className="mono">yourplatform.com</em>
            </div>
            <div className="wd-stage-body">
              <X402Widget
                key={enabled.join(",")}
                registrar={REGISTRAR}
                forwarder={FORWARDER}
                parents={parents}
                platformTreasury={DEMO_TREASURY}
                platformFeeWei={platformFeeWei}
                chain={mainnet}
                rpcUrl={RPC}
                theme={theme}
                blockExplorerUrl="https://etherscan.io"
                onSuccess={(label, _node, tx) => console.log("registered", label, tx)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "64px 0" }}>
        <div className="wrap">
          <div className="wd-code-head">
            <div>
              <div className="eyebrow">Your embed code</div>
              <h2 style={{ marginTop: 10 }}>Paste it anywhere a script tag works.</h2>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => {
                navigator.clipboard?.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied" : "Copy snippet"}
            </button>
          </div>
          <pre className="wd-code"><code className="mono">{snippet}</code></pre>
          <p className="wd-note" style={{ marginTop: 12 }}>
            Prefer React? The same options are props on{" "}
            <span className="mono">&lt;X402Widget theme=&quot;{theme}&quot; /&gt;</span> —{" "}
            <a href="/integrate/" style={{ textDecoration: "underline" }}>see the integration guide</a>.
          </p>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "64px 0 96px" }}>
        <div className="wrap">
          <ChainStrip />
        </div>
      </section>
    </main>
  );
}
