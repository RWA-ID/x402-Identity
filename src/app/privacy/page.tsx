import { pageMetadata } from "@/lib/seo";
import { SiteNav } from "@/components/SiteNav";

export const metadata = pageMetadata({
  title: "Privacy Policy — x402 Identity Hub",
  description:
    "How x402 Identity Hub handles data: a client-side dapp with no accounts, served from Cloudflare and IPFS, using Google Analytics for aggregate traffic statistics.",
  path: "/privacy/",
});

const UPDATED = "October 12, 2026";

export default function PrivacyPage() {
  return (
    <main className="site">
      <SiteNav links={[{ href: "/", label: "Home" }, { href: "/integrate/", label: "Integrate" }, { href: "/terms/", label: "Terms" }]} />

      <section style={{ padding: "72px 0 32px" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="eyebrow">Legal</div>
          <h1 style={{ marginTop: 12, fontSize: 40, letterSpacing: "-0.03em" }}>Privacy Policy</h1>
          <p style={{ marginTop: 16, color: "var(--muted)" }}>Last updated {UPDATED}</p>
        </div>
      </section>

      <section className="section-divider" style={{ padding: "48px 0 96px" }}>
        <div className="wrap legal" style={{ maxWidth: 760 }}>
          <p>
            x402 Identity Hub (&ldquo;the Hub,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is an open-source, fully
            client-side web application for minting ENS subnames under <span className="mono">402bot.eth</span>,{" "}
            <span className="mono">402api.eth</span>, and <span className="mono">402mcp.eth</span>. The interface is
            static and served from Cloudflare at <span className="mono">x402id.dev</span> and from IPFS at{" "}
            <span className="mono">x402id.eth</span>. We do not operate a backend server that receives, stores, or
            profiles your personal information.
          </p>

          <h2>1. Information we do not collect</h2>
          <p>
            We do not run accounts, logins, email lists, or advertising pixels. The Hub does not ask you for your
            name, email address, or any personally identifying details. The only analytics we use is Google Analytics,
            described in section 5.
          </p>

          <h2>2. Information handled in your browser</h2>
          <p>
            When you connect a wallet, your wallet provider and the WalletConnect / Reown relay store a session
            locally in your browser (via <span className="mono">localStorage</span>) so the connection can persist
            across page loads. This data stays on your device and is cleared when you disconnect or clear your browser
            storage. We never transmit it to us.
          </p>

          <h2>3. Third-party services</h2>
          <p>
            Because the Hub interacts with the Ethereum blockchain, certain independent services necessarily process
            technical data such as your public wallet address and IP address:
          </p>
          <ul>
            <li>
              <strong>WalletConnect / Reown</strong> — relays the encrypted connection between the Hub and your wallet.
            </li>
            <li>
              <strong>RPC providers (e.g. Alchemy, public nodes)</strong> — read blockchain state and broadcast the
              transactions you sign.
            </li>
            <li>
              <strong>Cloudflare and IPFS gateways</strong> — serve the static files that make up this interface.
            </li>
            <li>
              <strong>Google Analytics</strong> — measures aggregate site traffic (see section 5).
            </li>
          </ul>
          <p>
            These providers operate under their own privacy policies. We do not control and are not responsible for
            their data practices.
          </p>

          <h2>4. Onchain data is public and permanent</h2>
          <p>
            Minting an ENS subname is a public blockchain transaction. The label you choose, the parent name, your
            wallet address, and any records you set are written to Ethereum and to the public ENS registry. This
            information is permanent, globally visible, and cannot be deleted by us or by anyone. Do not mint a name
            or set records you are unwilling to make public forever.
          </p>

          <h2>5. Analytics and search engine verification</h2>
          <p>
            The site uses Google Analytics to understand aggregate traffic: which pages are visited, how visitors
            arrive, and their approximate region and device type. Google Analytics sets first-party cookies and
            processes your IP address under{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google&rsquo;s privacy policy
            </a>
            . We do not send your wallet address or any onchain activity to Google Analytics. The embeddable mint
            widget that partners place on their own sites does not load Google Analytics. You can opt out with
            Google&rsquo;s{" "}
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
              opt-out browser add-on
            </a>{" "}
            or by blocking cookies for this site.
          </p>
          <p>
            The site also includes Google Search Console verification tags so the domain owner can monitor indexing.
            These are verification signals only.
          </p>

          <h2>6. Children</h2>
          <p>
            The Hub is not directed to children under 13 and we do not knowingly collect information from them.
          </p>

          <h2>7. Changes to this policy</h2>
          <p>
            We may update this policy as the Hub evolves. Changes are published at this URL with a revised
            &ldquo;last updated&rdquo; date. Because the interface is also served from IPFS, prior versions may remain
            accessible at older content hashes.
          </p>

          <h2>8. Contact</h2>
          <p>
            Questions about this policy can be sent to{" "}
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
