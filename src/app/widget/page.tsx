"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { namehash, isAddress, type Address, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { X402Widget } from "@x402id/widget-react";

const FORWARDER: Address = "0x05af104ce913e7ef39799bfada871817d3761778";
const REGISTRAR: Address = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";
const RPC = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET;

const ALLOWED_PARENTS = ["402bot.eth", "402api.eth", "402mcp.eth"] as const;
type ParentLabel = (typeof ALLOWED_PARENTS)[number];

interface Parsed {
  treasury: Address;
  platformFeeWei: bigint;
  theme: "light" | "dark";
  parents: { label: ParentLabel; node: Hex }[];
  error?: string;
}

function parseParams(qs: string): Parsed | { error: string } {
  const p = new URLSearchParams(qs);
  const treasury = p.get("treasury") ?? "";
  if (!isAddress(treasury)) return { error: "Invalid or missing `treasury` address" };

  let platformFeeWei = 0n;
  const fee = p.get("platformFeeWei") ?? "0";
  try {
    platformFeeWei = BigInt(fee);
    if (platformFeeWei < 0n) throw new Error();
  } catch {
    return { error: "Invalid `platformFeeWei`" };
  }

  const themeRaw = (p.get("theme") ?? "light").toLowerCase();
  const theme: "light" | "dark" = themeRaw === "dark" ? "dark" : "light";

  const parentsRaw = (p.get("parents") ?? ALLOWED_PARENTS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const parents: { label: ParentLabel; node: Hex }[] = [];
  for (const label of parentsRaw) {
    if (!(ALLOWED_PARENTS as readonly string[]).includes(label)) {
      return { error: `Unsupported parent: ${label}` };
    }
    parents.push({ label: label as ParentLabel, node: namehash(label) });
  }
  if (parents.length === 0) return { error: "No parents configured" };

  return { treasury: treasury as Address, platformFeeWei, theme, parents };
}

export default function StandaloneWidget() {
  const [parsed, setParsed] = useState<Parsed | { error: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setParsed(parseParams(typeof window === "undefined" ? "" : window.location.search));
  }, []);

  // Post height to parent so the embed iframe can auto-resize.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = rootRef.current;
    if (!el) return;
    const post = () => {
      try {
        window.parent?.postMessage(
          { type: "x402id:resize", height: el.offsetHeight + 24 },
          "*",
        );
      } catch {}
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(el);
    return () => ro.disconnect();
  }, [parsed]);

  const config = useMemo(() => parsed, [parsed]);

  if (!config) return <main style={{ padding: 16 }} />;
  if ("error" in config) {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#dc2626" }}>
        <strong>Widget config error:</strong> {config.error}
      </main>
    );
  }

  return (
    <main
      ref={rootRef}
      style={{
        padding: 12,
        background: config.theme === "dark" ? "#0b0b0c" : "transparent",
        minHeight: "100%",
      }}
    >
      <X402Widget
        registrar={REGISTRAR}
        forwarder={FORWARDER}
        parents={config.parents}
        platformTreasury={config.treasury}
        platformFeeWei={config.platformFeeWei}
        chain={mainnet}
        rpcUrl={RPC}
        theme={config.theme}
        blockExplorerUrl="https://etherscan.io"
        onSuccess={(label, parentNode, txHash) => {
          try {
            window.parent?.postMessage(
              { type: "x402id:success", label, parentNode, txHash },
              "*",
            );
          } catch {}
        }}
      />
    </main>
  );
}
