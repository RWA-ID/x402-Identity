"use client";

import { useEffect, useState, useId } from "react";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { PARENTS, type Parent } from "@/lib/parents";
import { isValidLabel } from "@/lib/ens";
import { useAvailability } from "@/hooks/useAvailability";
import { useRegister } from "@/hooks/useRegister";
import { useBatchRegister } from "@/hooks/useBatchRegister";
import { useRecentMints } from "@/hooks/useRecentMints";
import { SuccessModal } from "@/components/SuccessModal";
import type { MintRow as MintRowType } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  initialParent?: string | null;
};

function getParentDisplay(parentNode: `0x${string}`) {
  return PARENTS.find((p) => p.node === parentNode)?.label ?? "unknown.eth";
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function relTime(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function MintDrawer({ open, onClose, initialParent }: Props) {
  const { open: openAppKit } = useAppKit();
  const { isConnected } = useAccount();

  const [selectedParent, setSelectedParent] = useState<Parent>(PARENTS[0]);
  const [labelInput, setLabelInput] = useState("");
  const [rows, setRows] = useState<MintRowType[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mintedRows, setMintedRows] = useState<MintRowType[]>([]);
  const idGen = useId();

  const single = useRegister();
  const batch = useBatchRegister();
  const recent = useRecentMints();

  const trimmed = labelInput.trim().toLowerCase();
  const valid = isValidLabel(trimmed);
  const alreadyQueued = rows.some(
    (r) => r.label === trimmed && r.parent.id === selectedParent.id,
  );

  const availability = useAvailability(selectedParent.node, valid ? trimmed : "");
  const checking = availability.isFetching && valid;
  const isAvailable = valid && !alreadyQueued && availability.data === true;
  const isTaken = valid && !alreadyQueued && availability.data === false;

  let availState: "idle" | "checking" | "available" | "taken" | "invalid" = "idle";
  let availText = "Enter a name to check availability";
  if (trimmed.length > 0) {
    if (!valid) {
      availState = "invalid";
      availText = "Invalid — min 3 chars · a–z 0–9 hyphens";
    } else if (alreadyQueued) {
      availState = "invalid";
      availText = "Already in your queue";
    } else if (checking || availability.data === undefined) {
      availState = "checking";
      availText = `Checking · ${trimmed}.${selectedParent.label}`;
    } else if (isAvailable) {
      availState = "available";
      availText = `${trimmed}.${selectedParent.label} · available`;
    } else if (isTaken) {
      availState = "taken";
      availText = `${trimmed}.${selectedParent.label} · already minted`;
    }
  }

  useEffect(() => {
    if (initialParent && open) {
      const match = PARENTS.find((p) => p.id === initialParent);
      if (match) setSelectedParent(match);
    }
  }, [initialParent, open]);

  useEffect(() => {
    if ((single.isSuccess || batch.isSuccess) && !showSuccess) {
      const captured =
        rows.length > 0
          ? rows
          : trimmed
            ? [{ id: "0", parent: selectedParent, label: trimmed }]
            : [];
      setMintedRows(captured);
      setShowSuccess(true);
    }
  }, [single.isSuccess, batch.isSuccess, showSuccess, rows, selectedParent, trimmed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addRow = () => {
    if (!isAvailable) return;
    setRows((prev) => [
      ...prev,
      { id: `${idGen}-${Date.now()}`, parent: selectedParent, label: trimmed },
    ]);
    setLabelInput("");
  };

  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const handleMint = () => {
    if (!isConnected) {
      openAppKit();
      return;
    }
    if (rows.length === 0 && isAvailable) {
      single.register(selectedParent.node, trimmed);
      return;
    }
    if (rows.length === 1) {
      single.register(rows[0].parent.node, rows[0].label);
    } else if (rows.length > 1) {
      batch.batchRegister(
        rows.map((r) => ({ parentNode: r.parent.node, label: r.label })),
      );
    }
  };

  const isPending = single.isPending || batch.isPending;
  const isConfirming = single.isConfirming || batch.isConfirming;
  const mintCount = rows.length > 0 ? rows.length : isAvailable ? 1 : 0;
  const totalEth = (mintCount * 0.005).toFixed(3);

  let mintLabel: React.ReactNode = (
    <>
      Add a name to start <span className="arrow">→</span>
    </>
  );
  if (mintCount > 0) {
    if (!isConnected) {
      mintLabel = (
        <>
          Connect wallet · mint {mintCount} name{mintCount === 1 ? "" : "s"} · {totalEth} ETH{" "}
          <span className="arrow">→</span>
        </>
      );
    } else if (isPending) {
      mintLabel = <>Confirm in wallet…</>;
    } else if (isConfirming) {
      mintLabel = <>Confirming on-chain…</>;
    } else {
      mintLabel = (
        <>
          Mint {mintCount} name{mintCount === 1 ? "" : "s"} · {totalEth} ETH{" "}
          <span className="arrow">→</span>
        </>
      );
    }
  }

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? "open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-hidden={!open}
        aria-label="Mint a name"
      >
        <div className="drawer-head">
          <span className="title">Mint a name</span>
          <button className="close-btn" aria-label="Close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          <span className="field-label">Namespace</span>
          <div className="parent-options">
            {PARENTS.map((p) => (
              <button
                key={p.id}
                className={`parent-option ${selectedParent.id === p.id ? "active" : ""}`}
                onClick={() => setSelectedParent(p)}
                type="button"
              >
                <span className="name">.{p.label}</span>
                <span className="desc">
                  {p.id === "402bot" ? "Agents" : p.id === "402api" ? "Services" : "MCP servers"}
                </span>
              </button>
            ))}
          </div>

          <div className="label-input-wrap">
            <span className="field-label" style={{ marginBottom: 10 }}>
              Search availability
            </span>
            <div className="input-row">
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  className="label-input"
                  type="text"
                  placeholder="myagent"
                  autoComplete="off"
                  spellCheck={false}
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value.toLowerCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRow();
                    }
                  }}
                />
                <span className="label-suffix">.{selectedParent.label}</span>
              </div>
              <button
                className="add-btn"
                disabled={!isAvailable}
                onClick={addRow}
                type="button"
              >
                + Add
              </button>
            </div>
            <div className="avail" data-state={availState}>
              <span className="ad" />
              <span>{availText}</span>
            </div>
          </div>
          <p className="hint">
            Min 3 chars · lowercase · a–z, 0–9, hyphens. Press{" "}
            <b style={{ color: "var(--ink)", fontFamily: "var(--mono)", fontWeight: 500 }}>Enter</b>{" "}
            to add to batch.
          </p>

          <div className="queue">
            <div className="queue-head">
              <span className="qt">
                Mint queue · <span>{rows.length}</span>
              </span>
              {rows.length > 0 && (
                <button className="clear" onClick={() => setRows([])} type="button">
                  Clear all
                </button>
              )}
            </div>
            {rows.length === 0 ? (
              <div className="queue-empty">No names queued. Add one above to start a batch.</div>
            ) : (
              <div className="queue-list">
                {rows.map((r) => (
                  <div key={r.id} className="qrow">
                    <span className="qname">
                      <b>{r.label}</b>.{r.parent.label}
                    </span>
                    <span className="qstate available">available</span>
                    <button className="qrm" aria-label="Remove" onClick={() => removeRow(r.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mint-summary">
            <div>
              <span className="k">Names</span>
              <br />
              <span className="v" style={{ fontSize: 18 }}>{mintCount}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="k">Total</span>
              <br />
              <span className="v" style={{ fontSize: 18 }}>{totalEth} ETH</span>
            </div>
          </div>

          <button
            className="btn btn-primary"
            disabled={mintCount === 0 || isPending || isConfirming}
            onClick={handleMint}
          >
            {mintLabel}
          </button>

          {(single.error || batch.error) && (
            <p
              style={{
                marginTop: 10,
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "#B0413E",
                textAlign: "center",
              }}
            >
              {(single.error || batch.error)?.message?.slice(0, 120)}
            </p>
          )}

          {recent.length > 0 && (
            <div className="recent">
              <h4>Recent mints</h4>
              {recent.slice(0, 5).map((m) => (
                <div key={`${m.subnameNode}-${m.timestamp}`} className="recent-row">
                  <span className="dot" />
                  <span className="name">
                    <b>{m.label}</b>.{getParentDisplay(m.parentNode)}
                  </span>
                  <span className="addr">{shortAddr(m.minter)}</span>
                  <span className="time">{relTime(m.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {showSuccess && (
        <SuccessModal
          minted={mintedRows}
          onClose={() => {
            setShowSuccess(false);
            setMintedRows([]);
            setRows([]);
            setLabelInput("");
            single.reset();
            batch.reset();
          }}
        />
      )}
    </>
  );
}
