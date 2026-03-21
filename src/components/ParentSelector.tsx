"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";
import { PARENTS, type Parent } from "@/lib/parents";

type ParentSelectorProps = {
  selected: Parent | null;
  onSelect: (parent: Parent) => void;
};

export function ParentSelector({ selected, onSelect }: ParentSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {PARENTS.map((parent, i) => {
        const isSelected = selected?.id === parent.id;
        return (
          <motion.button
            key={parent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(parent)}
            className={clsx(
              "relative text-left p-4 rounded-lg border transition-all duration-200",
              isSelected
                ? "border-[#f97316] bg-[rgba(249,115,22,0.1)] shadow-[0_0_20px_rgba(249,115,22,0.25)]"
                : "border-[#1f1f1f] bg-[#161616] hover:border-[#f97316]/50 hover:shadow-[0_0_15px_rgba(249,115,22,0.1)]"
            )}
          >
            {isSelected && (
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#f97316] shadow-[0_0_8px_#f97316]" />
            )}
            <div className="text-2xl mb-2">{parent.icon}</div>
            <div className="font-mono font-bold text-[#f0f0f0] mb-1">{parent.label}</div>
            <div className="text-sm text-[#666]">{parent.description}</div>
          </motion.button>
        );
      })}
    </div>
  );
}
