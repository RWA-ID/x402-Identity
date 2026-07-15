import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — x402 Identity Hub",
  description:
    "Terms of use for x402 Identity Hub — a non-custodial, open-source interface for minting ENS subnames for AI agents.",
  alternates: { canonical: "https://x402id.eth.link/terms/" },
};

const UPDATED = "July 14, 2026";

export default function TermsPage() {
  return (
    <main>
      <header className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="/" aria-label="x402 Identity Hub">
            <span className="brand-mark">x</span>
            <span>x402</span>
            <span className="brand-sub">/ identity hub</span>
          </a>
          <nav className="links">
            <a href="/">Home</a>
            <a href="/integrate/">Integrate</a>
            <a href="/privacy/">Privacy</a>
          </nav>
        </div>
      </header>

      <section style={{ padding: "72px 0 32px" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="eyebrow">Legal</div>
          <h1 style={{ marginTop: 12, fontSize: 40, letterSpacing: "-0.03em" }}>Terms &amp; Conditions</h1>
          <p style={{ marginTop: 16, color: "var(--muted)" }}>Last updated {UPDATED}</p>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "48px 0 96px" }}>
        <div className="wrap legal" style={{ maxWidth: 760 }}>
          <p>
            These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of the x402 Identity Hub interface (&ldquo;the
            Hub&rdquo;), an open-source, non-custodial web application for minting ENS subnames under{" "}
            <span className="mono">402bot.eth</span>, <span className="mono">402api.eth</span>, and{" "}
            <span className="mono">402mcp.eth</span>. By connecting a wallet or otherwise using the Hub, you agree to
            these Terms. If you do not agree, do not use the Hub.
          </p>

          <h2>1. The Hub is a non-custodial interface</h2>
          <p>
            The Hub is a front end to public smart contracts on the Ethereum blockchain and the Ethereum Name Service.
            We never take custody of your funds, private keys, wallets, or names. Every transaction is initiated and
            signed by you through your own wallet. We cannot execute, reverse, freeze, or recover transactions on your
            behalf.
          </p>

          <h2>2. Eligibility &amp; responsibility</h2>
          <p>
            You are responsible for ensuring your use of the Hub is lawful in your jurisdiction, for the security of
            your wallet and keys, and for reviewing every transaction before you sign it. You are solely responsible
            for the names you register and any records or content you associate with them.
          </p>

          <h2>3. Fees</h2>
          <p>
            Minting a subname may incur a protocol fee and/or a platform fee routed on-chain through the registrar and
            forwarder contracts, in addition to Ethereum network gas fees. All fees are disclosed in the interface
            before you sign. Blockchain and fee amounts are final; we cannot refund a completed transaction.
          </p>

          <h2>4. Names are onchain and permanent</h2>
          <p>
            ENS registrations are public, immutable blockchain records. Once minted, a subname and its records exist on
            Ethereum and the public ENS registry and cannot be deleted by us. You are responsible for renewing,
            managing, or transferring your names as applicable. Do not register names that infringe the rights of
            others.
          </p>

          <h2>5. No warranty</h2>
          <p>
            The Hub is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind,
            express or implied, including merchantability, fitness for a particular purpose, availability, or
            non-infringement. Smart contracts and blockchain networks are experimental and may contain bugs, and are
            offered without guarantee of uptime, security, or correctness. Any audit status is stated in the interface
            and may be pending.
          </p>

          <h2>6. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, the Hub&rsquo;s authors and contributors shall not be liable for
            any indirect, incidental, special, consequential, or exemplary damages, or for any loss of funds, names,
            profits, or data arising from your use of the Hub, the underlying smart contracts, third-party services,
            or the Ethereum network.
          </p>

          <h2>7. Third-party services</h2>
          <p>
            The Hub relies on independent services including wallet providers, the WalletConnect / Reown relay, RPC
            providers, and IPFS gateways. We do not control these services and are not responsible for their
            availability, conduct, or terms.
          </p>

          <h2>8. Open source</h2>
          <p>
            The Hub&rsquo;s source code is released under the MIT license. Your use of the code is governed by that
            license; these Terms govern your use of the hosted interface.
          </p>

          <h2>9. Changes</h2>
          <p>
            We may revise these Terms as the Hub evolves. Updated Terms are published at this URL with a new
            &ldquo;last updated&rdquo; date. Continued use after changes constitutes acceptance.
          </p>

          <h2>10. Contact</h2>
          <p>
            Questions about these Terms can be sent to{" "}
            <a href="mailto:x402id@onchain-id.id">x402id@onchain-id.id</a>.
          </p>

          <p style={{ marginTop: 40 }}>
            <a href="/" className="btn btn-ghost">
              ← Back to home
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
