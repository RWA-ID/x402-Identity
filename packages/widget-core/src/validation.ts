/** Mirrors X402SubnameRegistrar._isValidLabel + length check. */
export function validateLabel(label: string): string | null {
  if (label.length < 3) return "Label must be at least 3 characters";
  if (label.length > 63) return "Label too long";
  if (label.startsWith("-") || label.endsWith("-")) return "No leading or trailing hyphen";
  if (!/^[a-z0-9-]+$/.test(label)) return "Only lowercase a–z, 0–9, and hyphens";
  return null;
}
