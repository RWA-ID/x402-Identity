"use client";

import { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { MintDrawer } from "@/components/MintDrawer";
import { LiveMetrics } from "@/components/LiveMetrics";

const REGISTRAR = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

function EtherscanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 293.775 293.671" fill="currentColor" aria-hidden="true">
      <path d="M61.0411 138.4127a12.2645 12.2645 0 0 1 12.32-12.2589l20.43.0667a12.2769 12.2769 0 0 1 12.2769 12.2769v77.2517c2.3014-.6821 5.2567-1.4083 8.49-2.168a10.2293 10.2293 0 0 0 7.8987-9.9568V107.5957a12.2772 12.2772 0 0 1 12.2765-12.2774h20.4734a12.2772 12.2772 0 0 1 12.2765 12.2774v75.0235s5.1264-2.0743 10.1193-4.1824a10.2387 10.2387 0 0 0 6.2542-9.43V76.8439a12.2766 12.2766 0 0 1 12.2756-12.2765h20.4742a12.2772 12.2772 0 0 1 12.2769 12.2769v50.5188c17.7491-12.8634 35.7361-28.3334 50.005-46.9329a4.9292 4.9292 0 0 0 .7507-4.6716A146.927 146.927 0 0 0 73.355 18.6359a3.0747 3.0747 0 0 0-2.314 5.8881z" />
      <path d="M60.6147 184.2438a146.9128 146.9128 0 0 0 231.74-118.3061c0-3.2289-.114-6.4322-.32-9.6106-53.6411 80.025-152.789 117.2256-231.42 127.9167z" />
    </svg>
  );
}

function EnsIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.725.223 5.107 11.13a.146.146 0 0 1-.237.018c-.583-.692-2.753-3.64-.067-6.327 2.45-2.452 5.572-4.2 6.73-4.804.13-.068.269.08.192.206m-.366 23.747c.132.093.295-.064.206-.2-1.478-2.251-6.392-9.744-7.07-10.869-.67-1.11-1.987-2.953-2.097-4.53-.011-.158-.228-.19-.283-.042a10 10 0 0 0-.27.85c-1.105 4.11.5 8.472 3.985 10.916zm.909-.193 6.618-10.907a.146.146 0 0 1 .237-.018c.582.692 2.753 3.64.067 6.327-2.45 2.452-5.572 4.2-6.73 4.804-.13.068-.269-.08-.192-.206M12.641.028c-.132-.093-.295.065-.206.2 1.478 2.252 6.392 9.745 7.07 10.87.67 1.109 1.987 2.952 2.097 4.53.011.157.228.19.283.041.088-.239.182-.524.27-.85 1.105-4.11-.5-8.472-3.985-10.915z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function CopyBtn({ text, className = "btn btn-ghost copy-btn" }: { text: string; className?: string }) {
  const [label, setLabel] = useState("Copy");
  return (
    <button
      className={className}
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setLabel("Copied");
        setTimeout(() => setLabel("Copy"), 1200);
      }}
    >
      {label}
    </button>
  );
}

function CodeCopyBtn({ target }: { target: string }) {
  const [label, setLabel] = useState("Copy");
  return (
    <button
      className="copy"
      onClick={() => {
        const el = document.getElementById(target);
        if (!el) return;
        navigator.clipboard?.writeText(el.innerText);
        setLabel("Copied");
        setTimeout(() => setLabel("Copy"), 1200);
      }}
    >
      {label}
    </button>
  );
}

function NavConnect({ onMint }: { onMint: () => void }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

  return (
    <div className="nav-cta">
      {isConnected && address ? (
        <button className="btn btn-ghost" onClick={() => disconnect()}>
          <span className="mono" style={{ fontSize: 12 }}>{address.slice(0, 6)}…{address.slice(-4)}</span>
        </button>
      ) : (
        <button className="btn btn-ghost" onClick={() => open()}>
          Connect wallet
        </button>
      )}
      <button className="btn btn-primary" onClick={onMint}>
        Mint <span className="arrow">→</span>
      </button>
    </div>
  );
}

export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialParent, setInitialParent] = useState<string | null>(null);
  const [tlFilled, setTlFilled] = useState(false);

  const openDrawer = (parent?: string) => {
    setInitialParent(parent ?? null);
    setDrawerOpen(true);
  };

  useEffect(() => {
    const el = document.getElementById("tl-fill");
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setTlFilled(true);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* Header */}
      <header className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top" aria-label="x402 Identity Hub">
            <span className="brand-mark">x</span>
            <span>x402</span>
            <span className="brand-sub">/ identity hub</span>
          </a>
          <nav className="links">
            <a href="#namespaces">Namespaces</a>
            <a href="#institutions">Institutions</a>
            <a href="#architecture">Architecture</a>
            <a href="#permanence">Permanence</a>
            <a href="#developers">Developers</a>
            <a href="/integrate/">Integrate</a>
          </nav>
          <NavConnect onMint={() => openDrawer()} />
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="hero">
        <div className="wrap fade-up">
          <span className="status">
            <span className="dot" />
            Ethereum mainnet · live
          </span>
          <h1 style={{ marginTop: 32 }}>Permanent onchain identity for x402 agents.</h1>
          <p className="lede" style={{ marginTop: 28 }}>
            ENS subnames under{" "}
            <span className="mono" style={{ color: "var(--ink)" }}>402bot.eth</span>,{" "}
            <span className="mono" style={{ color: "var(--ink)" }}>402api.eth</span>, and{" "}
            <span className="mono" style={{ color: "var(--ink)" }}>402mcp.eth</span> — issued once,
            owned forever, resolvable on every chain.
          </p>
          <div className="hero-ctas">
            <button className="btn btn-primary btn-lg" onClick={() => openDrawer()}>
              Mint a name <span className="arrow">→</span>
            </button>
            <a className="btn btn-ghost btn-lg" href="#architecture">Read the spec</a>
            <a className="btn btn-ghost btn-lg mono" href="#developers" style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
              View contract
            </a>
          </div>
          <div className="hero-meta">
            <span><b style={{ color: "var(--ink)", fontWeight: 500 }}>0.005 ETH</b> &nbsp;per name</span>
            <span className="sep" />
            <span>No renewals · no expiry</span>
            <span className="sep" />
            <span>NameWrapper-locked</span>
            <span className="sep" />
            <span>Parent expiry <b style={{ color: "var(--ink)", fontWeight: 500 }}>3226 CE</b></span>
          </div>
        </div>
      </section>

      {/* Namespaces */}
      <section id="namespaces" className="section-divider">
        <div className="wrap">
          <div className="sec-head">
            <span className="index">01 / Namespaces</span>
            <div className="h">
              <h2>One tree. Three surfaces institutions integrate.</h2>
              <p>
                402bot, 402api, and 402mcp map to the three places autonomous software shows up
                in production today: agents that act on a user&apos;s behalf, services that expose
                paid endpoints, and Model Context Protocol servers that broker tool use.
              </p>
            </div>
          </div>

          <div className="ns-grid">
            {[
              {
                id: "402bot",
                tag: "Surface 01 — Agents",
                name: "402bot",
                desc: "Autonomous agents that hold wallets, negotiate, transact, and represent a principal across chains.",
                examples: ["treasury.402bot.eth", "scheduler.402bot.eth", "trader-7.402bot.eth"],
              },
              {
                id: "402api",
                tag: "Surface 02 — Services",
                name: "402api",
                desc: "Paid HTTP services that return data, run inference, or settle the HTTP 402 response in real time.",
                examples: ["prices.402api.eth", "inference.402api.eth", "geocode.402api.eth"],
              },
              {
                id: "402mcp",
                tag: "Surface 03 — MCP",
                name: "402mcp",
                desc: "Model Context Protocol servers — the tool surface assistants attach to. Resolvable by name, not by URL.",
                examples: ["github.402mcp.eth", "slack.402mcp.eth", "analytics.402mcp.eth"],
              },
            ].map((ns) => (
              <div key={ns.id} className="ns-card">
                <span className="ns-tag">{ns.tag}</span>
                <div className="ns-name">
                  <span>{ns.name}</span>
                  <span className="domain">.eth</span>
                </div>
                <p className="ns-desc">{ns.desc}</p>
                <div className="ns-examples">
                  {ns.examples.map((ex) => (
                    <div key={ex} className="ex mono">{ex}</div>
                  ))}
                </div>
                <button className="ns-cta mono" onClick={() => openDrawer(ns.id)}>
                  Mint under {ns.name} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Institutions */}
      <section id="institutions" className="section-divider">
        <div className="wrap">
          <div className="sec-head">
            <span className="index">02 / Institutions</span>
            <div className="h">
              <h2>Designed for both sides of the agent market.</h2>
              <p>
                Payment processors, infrastructure providers, and standards bodies issue and verify
                agent identities. Developers and end users mint and own them. The same primitive
                serves both audiences without intermediation.
              </p>
            </div>
          </div>

          <div className="inst-logos" aria-label="Illustrative integration targets — third-party trademarks">
            <div className="inst-logo"><img src="/logos/stripe.jpeg" alt="Stripe" /></div>
            <div className="inst-logo"><img src="/logos/aws.svg" alt="Amazon Web Services" /></div>
            <div className="inst-logo"><img src="/logos/cloudflare.jpeg" alt="Cloudflare" /></div>
            <div className="inst-logo"><img src="/logos/linux-foundation.svg" alt="The Linux Foundation" /></div>
            <div className="inst-logo"><img src="/logos/coinbase.png" alt="Coinbase" /></div>
            <div className="inst-logo"><img src="/logos/ens.jpeg" alt="ENS" /></div>
          </div>
          <p className="micro" style={{ marginTop: 14, maxWidth: "88ch", lineHeight: 1.6 }}>
            All third-party names, logos, and trademarks shown above are the property of their respective
            owners and are used here solely to illustrate integration surfaces relevant to x402. Their
            inclusion does not imply endorsement, sponsorship, partnership, affiliation, or any commercial
            relationship with x402 Identity Hub.
          </p>

          <div className="props">
            <div className="prop">
              <span className="prop-num">P.01</span>
              <h3>Verifiable identity</h3>
              <p>
                Every agent resolves to a single onchain record. Replace API-key allowlists and certificate
                pinning with namespace-level trust that any party can verify without a directory call.
              </p>
            </div>
            <div className="prop">
              <span className="prop-num">P.02</span>
              <h3>No vendor lock-in</h3>
              <p>
                ENS is a public good. No registrar, foundation, or platform can revoke a name. Identities
                port across wallets, chains, and providers without re-issuance.
              </p>
            </div>
            <div className="prop">
              <span className="prop-num">P.03</span>
              <h3>Audit-ready trail</h3>
              <p>
                Every issuance is a transaction. Every resolution is verifiable. Compliance can grep the
                chain — no proprietary log shipping, no opaque registrar API.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="section-divider">
        <div className="wrap">
          <div className="sec-head">
            <span className="index">03 / Architecture</span>
            <div className="h">
              <h2>One name, every chain, every wallet.</h2>
              <p>
                x402 sits between the agent and the broader ENS infrastructure. The NameWrapper holds the
                issued subname; resolvers expose it across L1, every major L2, and via CCIP-Read to anywhere
                ENS reaches.
              </p>
            </div>
          </div>

          <div className="arch-box">
            <svg className="arch-svg" viewBox="0 0 1080 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture diagram">
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                </marker>
              </defs>

              <g transform="translate(20,140)" color="var(--ink)">
                <rect x="0" y="0" width="160" height="100" rx="8" fill="var(--bg)" stroke="var(--line-2)" />
                <text x="80" y="22" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--muted)" letterSpacing="1.4">AGENT</text>
                <text x="80" y="50" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fill="var(--ink)">alice</text>
                <text x="80" y="72" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill="var(--accent)">.402bot.eth</text>
                <text x="80" y="92" textAnchor="middle" fontFamily="Inter" fontSize="10" fill="var(--muted)">holds wallet · signs</text>
              </g>

              <g color="var(--muted-2)">
                <line x1="180" y1="190" x2="240" y2="190" stroke="currentColor" strokeWidth="1" markerEnd="url(#arr)" />
                <text x="210" y="180" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--muted)" letterSpacing="0.8">register()</text>
              </g>

              <g transform="translate(240,140)" color="var(--ink)">
                <rect x="0" y="0" width="180" height="100" rx="8" fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.4" />
                <text x="90" y="22" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--accent)" letterSpacing="1.4">x402 REGISTRAR</text>
                <text x="90" y="50" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="13" fill="var(--ink)">X402SubnameRegistrar</text>
                <text x="90" y="72" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--muted)">0xeb9e…9633</text>
                <text x="90" y="92" textAnchor="middle" fontFamily="Inter" fontSize="10" fill="var(--muted)">fee · validation · fuses</text>
              </g>

              <g color="var(--muted-2)">
                <line x1="420" y1="190" x2="480" y2="190" stroke="currentColor" strokeWidth="1" markerEnd="url(#arr)" />
                <text x="450" y="180" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--muted)" letterSpacing="0.8">setSubnodeRecord()</text>
              </g>

              <g transform="translate(480,140)" color="var(--ink)">
                <rect x="0" y="0" width="180" height="100" rx="8" fill="var(--bg)" stroke="var(--line-2)" />
                <text x="90" y="22" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--muted)" letterSpacing="1.4">ENS NAMEWRAPPER</text>
                <text x="90" y="50" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="13" fill="var(--ink)">0xD441…6401</text>
                <text x="90" y="72" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--ink-2)">fuses: CANNOT_UNWRAP</text>
                <text x="90" y="88" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--ink-2)">PARENT_CANNOT_CONTROL</text>
              </g>

              <g color="var(--muted-2)">
                <line x1="660" y1="190" x2="720" y2="190" stroke="currentColor" strokeWidth="1" markerEnd="url(#arr)" />
                <text x="690" y="180" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--muted)" letterSpacing="0.8">resolve()</text>
              </g>

              <g transform="translate(720,140)" color="var(--ink)">
                <rect x="0" y="0" width="160" height="100" rx="8" fill="var(--bg)" stroke="var(--line-2)" />
                <text x="80" y="22" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--muted)" letterSpacing="1.4">RESOLVER</text>
                <text x="80" y="50" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="13" fill="var(--ink)">PublicResolver</text>
                <text x="80" y="72" textAnchor="middle" fontFamily="Inter" fontSize="10" fill="var(--muted)">addr · text · contenthash</text>
                <text x="80" y="92" textAnchor="middle" fontFamily="Inter" fontSize="10" fill="var(--muted)">CCIP-Read enabled</text>
              </g>

              <g color="var(--muted-2)">
                <path d="M880 190 L940 80" stroke="currentColor" strokeWidth="1" fill="none" />
                <path d="M880 190 L960 145" stroke="currentColor" strokeWidth="1" fill="none" />
                <path d="M880 190 L960 195" stroke="currentColor" strokeWidth="1" fill="none" />
                <path d="M880 190 L960 245" stroke="currentColor" strokeWidth="1" fill="none" />
                <path d="M880 190 L940 300" stroke="currentColor" strokeWidth="1" fill="none" />
              </g>

              <g fontFamily="JetBrains Mono" fontSize="10" fill="var(--ink-2)">
                <g transform="translate(950,70)"><rect width="110" height="22" rx="4" fill="var(--bg)" stroke="var(--line-2)" /><text x="55" y="14" textAnchor="middle">Ethereum L1</text></g>
                <g transform="translate(970,135)"><rect width="90" height="22" rx="4" fill="var(--bg)" stroke="var(--line-2)" /><text x="45" y="14" textAnchor="middle">Base</text></g>
                <g transform="translate(970,185)"><rect width="90" height="22" rx="4" fill="var(--bg)" stroke="var(--line-2)" /><text x="45" y="14" textAnchor="middle">Optimism</text></g>
                <g transform="translate(970,235)"><rect width="90" height="22" rx="4" fill="var(--bg)" stroke="var(--line-2)" /><text x="45" y="14" textAnchor="middle">Arbitrum</text></g>
                <g transform="translate(950,290)"><rect width="110" height="22" rx="4" fill="var(--bg)" stroke="var(--line-2)" /><text x="55" y="14" textAnchor="middle">Linea · CCIP-*</text></g>
              </g>

              <g>
                <text x="540" y="350" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--muted)" letterSpacing="1">
                  Single transaction · Single source of truth · No off-chain registrar
                </text>
              </g>
            </svg>

            <div className="arch-legend">
              <div className="row"><span className="k">Registrar</span><span>Receives the 0.005 ETH fee, validates the label, and calls the NameWrapper.</span></div>
              <div className="row"><span className="k">NameWrapper</span><span>Issues the wrapped subname with permanence fuses burned at mint time.</span></div>
              <div className="row"><span className="k">Resolver</span><span>Exposes address, text, and contenthash records to any consumer of ENS.</span></div>
              <div className="row"><span className="k">CCIP-Read</span><span>Resolves the name from any chain or off-chain backend implementing EIP-3668.</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Metrics */}
      <section id="metrics" className="section-divider">
        <div className="wrap">
          <div className="sec-head">
            <span className="index">04 / Live metrics</span>
            <div className="h">
              <h2>Verifiable, in real time.</h2>
              <p>Everything you can grep on Etherscan, surfaced as live state. No analytics layer, no proprietary dashboard — just the chain.</p>
            </div>
          </div>

          <LiveMetrics />
        </div>
      </section>

      {/* Permanence */}
      <section id="permanence" className="section-divider">
        <div className="wrap">
          <div className="sec-head">
            <span className="index">05 / Permanence</span>
            <div className="h">
              <h2>An identity you can build a 10-year roadmap on.</h2>
              <p>
                Procurement teams need a guarantee, not a promise. The NameWrapper enforces immutability at
                the protocol level, and the 1,200-year parent extension removes the only remaining failure
                mode: the parent name itself.
              </p>
            </div>
          </div>

          <div className="permanence-grid">
            <div className="perm-body">
              <h3 style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 500 }}>
                NameWrapper fuses, burned at mint
              </h3>
              <p>
                Every subname is issued with a fixed set of ENS fuses already burned. Once set, fuses cannot
                be cleared — by us, by the parent owner, by the registrar contract, or by a future governance
                vote. The agent holds the name on the same terms as any 2nd-level ENS domain.
              </p>

              <div className="fuse-list">
                <div className="fuse-row">
                  <div className="k">CANNOT_UNWRAP</div>
                  <div className="v">The wrap cannot be removed. The fuses cannot be reset by unwrapping and rewrapping.</div>
                </div>
                <div className="fuse-row">
                  <div className="k">PARENT_CANNOT_CONTROL</div>
                  <div className="v">The parent owner — including us — cannot reclaim, replace, or burn the subname.</div>
                </div>
                <div className="fuse-row">
                  <div className="k">CANNOT_BURN_FUSES</div>
                  <div className="v">No additional fuses can be set after issuance. The permission set is final.</div>
                </div>
                <div className="fuse-row">
                  <div className="k">CANNOT_SET_RESOLVER</div>
                  <div className="v" style={{ color: "var(--muted)" }}>Reserved — controlled by the holder, not the parent.</div>
                </div>
              </div>

              <p style={{ marginTop: 28 }}>
                Combined with the parent longevity commitment, the procurement guarantee is simple: a name
                minted today resolves on ENS through the year{" "}
                <b style={{ fontFamily: "var(--mono)", color: "var(--ink)", fontWeight: 500 }}>3226</b>{" "}
                with no required action from the holder.
              </p>
            </div>

            <aside className="timeline">
              <div className="tl-head">
                <span className="label">PARENT EXPIRY — 402BOT.ETH</span>
                <span className="year">3226 CE</span>
              </div>
              <div className="tl-bar">
                <div className="fill" id="tl-fill" style={{ width: tlFilled ? "100%" : "0%" }} />
              </div>
              <div className="tl-axis">
                <span>2026</span>
                <span>2126</span>
                <span>2526</span>
                <span>3226</span>
              </div>

              <div className="tl-rows" style={{ marginTop: 28 }}>
                <div className="tl-row">
                  <span className="k">YEAR 1</span>
                  <div className="b"><i style={{ width: "10%" }} /></div>
                  <span className="v">+120 yr</span>
                </div>
                <div className="tl-row">
                  <span className="k">YEAR 5</span>
                  <div className="b"><i style={{ width: "50%" }} /></div>
                  <span className="v">+600 yr</span>
                </div>
                <div className="tl-row">
                  <span className="k">YEAR 10</span>
                  <div className="b"><i style={{ width: "100%" }} /></div>
                  <span className="v">+1,200 yr</span>
                </div>
              </div>

              <p style={{ marginTop: 22, fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.55 }}>
                Starting Jun 1 2026, each parent&apos;s expiry is extended by 10 years every month for 10
                years — adding 120 years per calendar year, 1,200 years cumulative.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* Developers */}
      <section id="developers" className="section-divider">
        <div className="wrap">
          <div className="sec-head">
            <span className="index">06 / Integrate</span>
            <div className="h">
              <h2>One contract, two calls, no SDK required.</h2>
              <p>
                The registrar exposes a register/batchRegister pair and an availability check. Wagmi, viem,
                ethers, cast — anything that speaks the ABI works.
              </p>
            </div>
          </div>

          <div className="contract-row">
            <div className="meta">
              <span className="l">X402SubnameRegistrar · Ethereum mainnet</span>
              <span className="addr">{REGISTRAR}</span>
            </div>
            <div className="actions">
              <CopyBtn text={REGISTRAR} />
              <a className="btn btn-ghost" href={`https://etherscan.io/address/${REGISTRAR}`} target="_blank" rel="noopener">
                Etherscan <span className="arrow">↗</span>
              </a>
            </div>
          </div>

          <div className="dev-grid">
            <div className="code-card">
              <div className="code-head">
                <span className="title">check availability · cast</span>
                <CodeCopyBtn target="code-cast" />
              </div>
              <div className="code-body">
                <pre id="code-cast">
                  <span className="c"># Is &apos;alice&apos; available under 402bot.eth?</span>
{"\n"}cast <span className="k">call</span> <span className="p">\\</span>
{"\n"}  0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633 <span className="p">\\</span>
{"\n"}  <span className="s">&quot;isAvailable(bytes32,string)&quot;</span> <span className="p">\\</span>
{"\n"}  $(cast namehash 402bot.eth) <span className="p">\\</span>
{"\n"}  <span className="s">&quot;alice&quot;</span>
                </pre>
              </div>
            </div>

            <div className="code-card">
              <div className="code-head">
                <span className="title">register · wagmi</span>
                <CodeCopyBtn target="code-wagmi" />
              </div>
              <div className="code-body">
                <pre id="code-wagmi">
                  <span className="k">import</span> {"{ useWriteContract }"} <span className="k">from</span> <span className="s">&apos;wagmi&apos;</span>
{"\n"}<span className="k">import</span> {"{ namehash, parseEther }"} <span className="k">from</span> <span className="s">&apos;viem&apos;</span>
{"\n"}
{"\n"}<span className="k">const</span> {"{ writeContract }"} = useWriteContract()
{"\n"}
{"\n"}writeContract({"{"}
{"\n"}  address: <span className="s">&apos;0xeb9e…9633&apos;</span>,
{"\n"}  abi:     registrarAbi,
{"\n"}  functionName: <span className="s">&apos;register&apos;</span>,
{"\n"}  args: [namehash(<span className="s">&apos;402bot.eth&apos;</span>), <span className="s">&apos;alice&apos;</span>, owner],
{"\n"}  value: parseEther(<span className="s">&apos;0.005&apos;</span>),
{"\n"}{"}"})
                </pre>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a className="btn btn-ghost" href="https://github.com/RWA-ID/x402-Identity" target="_blank" rel="noopener">
              GitHub repository <span className="arrow">↗</span>
            </a>
            <a className="btn btn-ghost" href="https://github.com/RWA-ID/x402-Identity/blob/main/contracts/X402SubnameRegistrar.sol" target="_blank" rel="noopener">
              Read the contract <span className="arrow">↗</span>
            </a>
            <a className="btn btn-ghost" href="https://docs.ens.domains/wrapper/overview" target="_blank" rel="noopener">
              NameWrapper spec <span className="arrow">↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-col">
              <a className="brand" href="#top">
                <span className="brand-mark">x</span>
                <span>x402</span>
                <span className="brand-sub">/ identity hub</span>
              </a>
              <p className="foot-tag">
                Permanent onchain identity for x402 agents — issued under 402bot.eth, 402api.eth, and 402mcp.eth.
              </p>
            </div>
            <div className="foot-col">
              <h4>Product</h4>
              <ul>
                <li><button onClick={() => openDrawer()} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "inherit", font: "inherit" }}>Mint</button></li>
                <li><a href="#namespaces">Namespaces</a></li>
                <li><a href="#architecture">Architecture</a></li>
                <li><a href="#metrics">Live metrics</a></li>
                <li><a href="/integrate/">Integrate (platforms)</a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h4>Resources</h4>
              <ul>
                <li><a href="https://github.com/RWA-ID/x402-Identity" target="_blank" rel="noopener"><span className="foot-ico"><GitHubIcon /></span>GitHub ↗</a></li>
                <li><a href={`https://etherscan.io/address/${REGISTRAR}`} target="_blank" rel="noopener"><span className="foot-ico"><EtherscanIcon /></span>Contract ↗</a></li>
                <li><a href="https://app.ens.domains" target="_blank" rel="noopener"><span className="foot-ico"><EnsIcon /></span>ENS Manager ↗</a></li>
                <li><a href="#">Audit (pending)</a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h4>Contact</h4>
              <ul>
                <li><a href="mailto:x402id@onchain-id.id">x402id@onchain-id.id</a></li>
                <li><a href="https://twitter.com/x402identity" target="_blank" rel="noopener"><span className="foot-ico"><XIcon /></span>@x402identity ↗</a></li>
                <li><a href="#">License · MIT</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span>x402id.eth · IPFS</span>
            <span>© 2026 — Built on ENS · Hosted on IPFS</span>
          </div>
        </div>
      </footer>

      <MintDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialParent={initialParent}
      />
    </>
  );
}
