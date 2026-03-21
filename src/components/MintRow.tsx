"use client";

import { useAvailability } from "@/hooks/useAvailability";
import { Badge } from "@/components/ui/Badge";
import { isValidLabel } from "@/lib/ens";
import type { MintRow as MintRowType } from "@/types";

type MintRowProps = {
  row: MintRowType;
  onRemove: (id: string) => void;
};

export function MintRow({ row, onRemove }: MintRowProps) {
  const valid = isValidLabel(row.label);
  const { data: available, isLoading } = useAvailability(
    row.parent.node,
    valid ? row.label : ""
  );

  const status = !valid
    ? "invalid"
    : isLoading
    ? "loading"
    : available
    ? "available"
    : "taken";

  return (
    <div className="flex items-center gap-3 p-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg">
      <span className="font-mono text-sm text-[#666]">{row.parent.icon}</span>
      <span className="font-mono text-[#f0f0f0] flex-1 truncate">
        <span className="text-[#f97316]">{row.label}</span>
        <span className="text-[#666]">.{row.parent.label}</span>
      </span>
      <Badge status={status} />
      <button
        onClick={() => onRemove(row.id)}
        className="text-[#444] hover:text-red-400 transition-colors font-mono text-lg leading-none"
        aria-label="Remove"
      >
        ×
      </button>
    </div>
  );
}
