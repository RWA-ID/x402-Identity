import type { Parent } from "@/lib/parents";

export type MintRow = {
  id: string;
  parent: Parent;
  label: string;
};

export type MintStatus = "idle" | "checking" | "available" | "taken" | "invalid";
