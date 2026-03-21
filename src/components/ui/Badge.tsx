import { clsx } from "clsx";

type BadgeProps = {
  status: "available" | "taken" | "loading" | "invalid";
};

const STATUS_MAP = {
  available: { label: "Available", className: "bg-green-500/10 text-green-400 border-green-500/30" },
  taken: { label: "Taken", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  loading: { label: "Checking...", className: "bg-gray-500/10 text-gray-400 border-gray-500/30 animate-pulse" },
  invalid: { label: "Invalid", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
};

export function Badge({ status }: BadgeProps) {
  const { label, className } = STATUS_MAP[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 text-xs font-mono rounded border",
        className
      )}
    >
      {label}
    </span>
  );
}
