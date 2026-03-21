"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRecentMints } from "@/hooks/useRecentMints";
import { PARENTS } from "@/lib/parents";

function getParentDisplay(parentNode: `0x${string}`) {
  const match = PARENTS.find((p) => p.node === parentNode);
  return match ? match.label : "unknown.eth";
}

export function RecentMints() {
  const mints = useRecentMints();

  if (mints.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-sm font-mono text-[#666] uppercase tracking-wider mb-3">
        Recent Mints
      </h3>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {mints.map((mint) => (
            <motion.div
              key={`${mint.subnameNode}-${mint.timestamp}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-2.5 bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#22c55e]" />
              <span className="font-mono text-sm text-[#f0f0f0] flex-1">
                <span className="text-[#f97316]">{mint.label}</span>
                <span className="text-[#555]">.{getParentDisplay(mint.parentNode)}</span>
              </span>
              <span className="font-mono text-xs text-[#444]">
                {mint.minter.slice(0, 6)}...{mint.minter.slice(-4)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
