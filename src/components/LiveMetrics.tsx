"use client";

import { useMintStats } from "@/hooks/useMintStats";
import { PARENTS } from "@/lib/parents";

const REGISTRAR = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";

function parentLabel(node: `0x${string}`) {
  return PARENTS.find((p) => p.node === node)?.label ?? "unknown.eth";
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function LiveMetrics() {
  const { total, last } = useMintStats();

  return (
    <div className="metrics">
      <div className="metric live">
        <span className="label">Names minted</span>
        <span className="value tabular">
          {total === null ? "—" : total.toLocaleString()}
        </span>
        <span className="sub">all-time · across all parents</span>
      </div>
      <div className="metric">
        <span className="label">Parent expiry</span>
        <span className="value">3226 CE</span>
        <span className="sub">+1,200 years over 10-year commitment</span>
      </div>
      <div className="metric">
        <span className="label">Registrar</span>
        <span
          className="value"
          style={{ fontSize: 14, wordBreak: "break-all", lineHeight: 1.4 }}
        >
          0xeb9e9ea3
          <br />
          85fe28b51a3f
          <br />
          9a7d93fb893e
          <br />
          0a1f9633
        </span>
        <span className="sub">
          <a
            href={`https://etherscan.io/address/${REGISTRAR}`}
            target="_blank"
            rel="noopener"
            style={{ color: "var(--accent)" }}
          >
            View on Etherscan ↗
          </a>
        </span>
      </div>
      <div className="metric live">
        <span className="label">Last mint</span>
        {last ? (
          <>
            <span className="value" style={{ fontSize: 18, lineHeight: 1.4 }}>
              <span className="mono" style={{ color: "var(--accent)" }}>
                {last.label}
              </span>
              .{parentLabel(last.parentNode)}
            </span>
            <span className="sub">
              {last.timestamp ? relTime(last.timestamp) : "recent"} · {shortAddr(last.minter)}
            </span>
          </>
        ) : (
          <>
            <span className="value" style={{ fontSize: 18, lineHeight: 1.4, color: "var(--muted)" }}>
              awaiting first mint
            </span>
            <span className="sub">live · listening for SubnameMinted</span>
          </>
        )}
      </div>
    </div>
  );
}
