const CSS = `
.x402id-root { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #111; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; max-width: 420px; box-sizing: border-box; }
.x402id-root[data-theme="dark"] { color: #f3f4f6; background: #0b0b0c; border-color: #27272a; }
.x402id-h { font-size: 14px; font-weight: 600; margin: 0 0 12px; letter-spacing: .02em; text-transform: uppercase; opacity: .7; }
.x402id-row { display: flex; gap: 8px; align-items: stretch; }
.x402id-input { flex: 1; padding: 10px 12px; border: 1px solid #d4d4d8; border-radius: 10px; font-size: 15px; outline: none; background: inherit; color: inherit; }
.x402id-root[data-theme="dark"] .x402id-input { border-color: #3f3f46; }
.x402id-input:focus { border-color: #6366f1; }
.x402id-select { padding: 10px 12px; border: 1px solid #d4d4d8; border-radius: 10px; font-size: 14px; background: inherit; color: inherit; }
.x402id-root[data-theme="dark"] .x402id-select { border-color: #3f3f46; }
.x402id-btn { width: 100%; margin-top: 12px; padding: 11px 14px; border-radius: 10px; border: 0; background: #111; color: #fff; font-weight: 600; font-size: 15px; cursor: pointer; }
.x402id-root[data-theme="dark"] .x402id-btn { background: #f3f4f6; color: #0b0b0c; }
.x402id-btn:disabled { opacity: .5; cursor: not-allowed; }
.x402id-msg { font-size: 13px; margin-top: 8px; min-height: 18px; }
.x402id-err { color: #dc2626; }
.x402id-ok  { color: #16a34a; }
.x402id-breakdown { margin-top: 14px; padding-top: 14px; border-top: 1px dashed #e5e7eb; font-size: 13px; }
.x402id-root[data-theme="dark"] .x402id-breakdown { border-color: #27272a; }
.x402id-line { display: flex; justify-content: space-between; margin: 4px 0; }
.x402id-line.tot { font-weight: 600; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
.x402id-root[data-theme="dark"] .x402id-line.tot { border-color: #27272a; }
.x402id-muted { opacity: .65; }
.x402id-link { color: inherit; text-decoration: underline; }
`;

let injected = false;
export function injectStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-x402id", "");
  el.textContent = CSS;
  document.head.appendChild(el);
}
