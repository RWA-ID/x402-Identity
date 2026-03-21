"use client";

import { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { PARENTS, type Parent } from "@/lib/parents";
import { isValidLabel } from "@/lib/ens";
import { ParentSelector } from "@/components/ParentSelector";
import { MintRow } from "@/components/MintRow";
import { Button } from "@/components/ui/Button";
import { useRegister } from "@/hooks/useRegister";
import { useBatchRegister } from "@/hooks/useBatchRegister";
import { SuccessModal } from "@/components/SuccessModal";
import type { MintRow as MintRowType } from "@/types";

export function MintForm() {
  const { isConnected } = useAccount();
  const [selectedParent, setSelectedParent] = useState<Parent | null>(PARENTS[0]);
  const [labelInput, setLabelInput] = useState("");
  const [rows, setRows] = useState<MintRowType[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const idGen = useId();

  const single = useRegister();
  const batch = useBatchRegister();

  const isPending = single.isPending || batch.isPending;
  const isConfirming = single.isConfirming || batch.isConfirming;

  // Show success modal when tx confirms
  if ((single.isSuccess || batch.isSuccess) && !showSuccess) {
    setShowSuccess(true);
  }

  const addRow = () => {
    const label = labelInput.trim().toLowerCase();
    if (!label || !selectedParent) return;
    if (!isValidLabel(label)) return;
    if (rows.some((r) => r.label === label && r.parent.id === selectedParent.id)) return;

    setRows((prev) => [
      ...prev,
      { id: `${idGen}-${Date.now()}`, parent: selectedParent, label },
    ]);
    setLabelInput("");
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const handleMint = () => {
    if (rows.length === 0 && selectedParent && labelInput) {
      // Quick single mint without adding to list
      single.register(selectedParent.node, labelInput.trim().toLowerCase());
      return;
    }
    if (rows.length === 1) {
      single.register(rows[0].parent.node, rows[0].label);
    } else if (rows.length > 1) {
      batch.batchRegister(rows.map((r) => ({ parentNode: r.parent.node, label: r.label })));
    }
  };

  const mintCount = rows.length > 0 ? rows.length : labelInput.length >= 3 && selectedParent ? 1 : 0;
  const totalFee = (mintCount || 1) * 0.005;
  const canMint = isConnected && mintCount > 0;

  return (
    <>
      <div className="space-y-6">
        {/* Parent selector */}
        <div>
          <label className="block text-sm font-mono text-[#666] mb-3 uppercase tracking-wider">
            Choose Namespace
          </label>
          <ParentSelector selected={selectedParent} onSelect={setSelectedParent} />
        </div>

        {/* Label input */}
        <div>
          <label className="block text-sm font-mono text-[#666] mb-2 uppercase tracking-wider">
            Subdomain Label
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === "Enter" && addRow()}
                placeholder="myagent"
                className="w-full bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg px-4 py-3 font-mono text-[#f0f0f0] placeholder:text-[#333] focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_2px_rgba(249,115,22,0.15)] transition-all"
              />
              {selectedParent && labelInput && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-[#444] pointer-events-none">
                  .{selectedParent.label}
                </span>
              )}
            </div>
            <Button variant="secondary" onClick={addRow} disabled={!labelInput || !selectedParent}>
              + Add
            </Button>
          </div>
          <p className="mt-1.5 text-xs font-mono text-[#444]">
            Min 3 chars · lowercase · a-z, 0-9, hyphens only
          </p>
        </div>

        {/* Mint queue */}
        <AnimatePresence>
          {rows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-[#666] uppercase tracking-wider">
                  Mint Queue ({rows.length})
                </span>
                <button
                  onClick={() => setRows([])}
                  className="text-xs font-mono text-[#444] hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
              {rows.map((row) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <MintRow row={row} onRemove={removeRow} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mint button */}
        <div className="pt-2">
          {!isConnected ? (
            <div className="text-center text-sm font-mono text-[#666] py-3 border border-dashed border-[#1f1f1f] rounded-lg">
              Connect your wallet to mint
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={handleMint}
              disabled={!canMint}
              loading={isPending || isConfirming}
            >
              {isConfirming
                ? "Confirming..."
                : isPending
                ? "Confirm in Wallet..."
                : `Mint ${mintCount} ${mintCount === 1 ? "Name" : "Names"} · ${totalFee.toFixed(3)} ETH`}
            </Button>
          )}

          {(single.error || batch.error) && (
            <p className="mt-2 text-xs font-mono text-red-400 text-center">
              {(single.error || batch.error)?.message?.slice(0, 80)}
            </p>
          )}
        </div>
      </div>

      {showSuccess && (
        <SuccessModal
          minted={rows.length > 0 ? rows : selectedParent ? [{ id: "0", parent: selectedParent, label: labelInput }] : []}
          onClose={() => {
            setShowSuccess(false);
            setRows([]);
            setLabelInput("");
          }}
        />
      )}
    </>
  );
}
