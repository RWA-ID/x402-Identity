"use client";

import { useState } from "react";
import type { MintRow } from "@/types";

type SuccessModalProps = {
  minted: MintRow[];
  onClose: () => void;
};

export function SuccessModal({ minted, onClose }: SuccessModalProps) {
  const names = minted.map((r) => `${r.label}.${r.parent.label}`);
  const [copied, setCopied] = useState<string | null>(null);

  const tweetText = encodeURIComponent(
    names.length === 1
      ? `Just minted ${names[0]} on @x402identity's x402 Identity Hub.\n\nPermanent onchain identity for x402 agents under 402bot.eth / 402api.eth / 402mcp.eth.\n\nMint yours: https://x402id.eth.link`
      : `Just minted ${names.length} ENS subnames on @x402identity's x402 Identity Hub.\n\n${names.join(" · ")}\n\nMint yours: https://x402id.eth.link`,
  );

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 1200);
  };

  return (
    <div className="success-panel">
      <div className="success-head">
        <span className="success-eyebrow">
          <span className="success-dot" />
          Confirmed on Ethereum
        </span>
        <h3 className="success-title">
          {names.length === 1 ? "Name minted." : `${names.length} names minted.`}
        </h3>
        <p className="success-sub">
          Wrapped on the NameWrapper with permanence fuses burned. Yours forever.
        </p>
      </div>

      <div className="success-list">
        {minted.map((r, i) => {
          const full = names[i];
          return (
            <div key={r.id ?? full} className="success-row">
              <span className="success-name">
                <b>{r.label}</b>
                <span className="success-parent">.{r.parent.label}</span>
              </span>
              <div className="success-actions">
                <button className="success-link" onClick={() => copy(full)}>
                  {copied === full ? "Copied" : "Copy"}
                </button>
                <a
                  className="success-link"
                  href={`https://app.ens.domains/${full}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ENS ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <a
        href={`https://twitter.com/intent/tweet?text=${tweetText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        style={{ width: "100%", marginTop: 18, height: 46 }}
      >
        Share on X <span className="arrow">→</span>
      </a>

      <div className="success-promo">
        Share your post and reply to{" "}
        <a
          href="https://twitter.com/x402identity"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)" }}
        >
          @x402identity
        </a>{" "}
        to claim one free additional subdomain. First come, first served.
      </div>

      <button
        className="btn btn-ghost"
        style={{ width: "100%", marginTop: 12 }}
        onClick={onClose}
      >
        Mint more
      </button>
    </div>
  );
}
