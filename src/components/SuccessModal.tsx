"use client";

import { useEffect, useRef, useState } from "react";
import type { MintRow } from "@/types";
import { useSetAddress } from "@/hooks/useSetAddress";

type SuccessModalProps = {
  minted: MintRow[];
  onClose: () => void;
};

export function SuccessModal({ minted, onClose }: SuccessModalProps) {
  const names = minted.map((r) => `${r.label}.${r.parent.label}`);
  const [copied, setCopied] = useState<string | null>(null);
  const link = useSetAddress();

  // A fresh name resolves to 0x0 — prompt the address signature once, right after the mint.
  const prompted = useRef(false);
  useEffect(() => {
    if (prompted.current || !link.address || names.length === 0) return;
    prompted.current = true;
    void link.setAddress(names);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.address]);

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
          Wrapped on the NameWrapper — the parent can&apos;t reclaim it. No renewals for you: it stays active as the parent names are renewed.
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

      <div className="success-link-step">
        {link.state === "linked" ? (
          <p className="success-sub" style={{ color: "var(--accent)" }}>
            {names.length === 1 ? "It now resolves" : "They now resolve"} to{" "}
            {link.address?.slice(0, 6)}…{link.address?.slice(-4)} on Ethereum and Base.{" "}
            <a href={`/verify/?name=${encodeURIComponent(names.join(","))}`} style={{ textDecoration: "underline" }}>
              Running an x402 endpoint? Make {names.length === 1 ? "it" : "them"} a verified payee →
            </a>
          </p>
        ) : (
          <>
            <p className="success-sub">
              Last step: point {names.length === 1 ? "it" : "them"} at your wallet so{" "}
              {names.length === 1 ? "it resolves" : "they resolve"} on Ethereum and Base. Until then{" "}
              {names.length === 1 ? "the name resolves" : "the names resolve"} to nothing.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 12, height: 46 }}
              onClick={() => link.setAddress(names)}
              disabled={link.state === "signing" || link.state === "confirming"}
            >
              {link.state === "signing"
                ? "Confirm in wallet…"
                : link.state === "confirming"
                  ? "Confirming on-chain…"
                  : "Set my address"}
            </button>
            {link.error && (
              <p style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11, color: "#B0413E" }}>
                {link.error.slice(0, 120)}
              </p>
            )}
          </>
        )}
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
