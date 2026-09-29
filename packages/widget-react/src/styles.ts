// Every theme is a set of custom properties; the rules below only read them.
const CSS = `
.x402id-root {
  --x-bg: #ffffff; --x-fg: #0a0b0d; --x-muted: #5b6168; --x-line: #e4e4df; --x-soft: #f4f4ef;
  --x-accent: #0080bc; --x-accent-fg: #ffffff; --x-tint: rgba(0,128,188,.08);
  --x-ok: #15803d; --x-err: #dc2626; --x-shadow: 0 1px 2px rgba(16,20,26,.05), 0 18px 40px -24px rgba(16,20,26,.25);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--x-fg); background: var(--x-bg); border: 1px solid var(--x-line); border-radius: 16px;
  padding: 20px; max-width: 420px; box-sizing: border-box; box-shadow: var(--x-shadow);
}
.x402id-root *, .x402id-root *::before, .x402id-root *::after { box-sizing: border-box; }
.x402id-root[data-theme="dark"] {
  --x-bg: #0b0d10; --x-fg: #f2f4f7; --x-muted: #8b9099; --x-line: #262b32; --x-soft: #111418;
  --x-accent: #1a9ad6; --x-accent-fg: #ffffff; --x-tint: rgba(26,154,214,.14);
  --x-ok: #4ade80; --x-err: #f87171; --x-shadow: 0 18px 40px -24px rgba(0,0,0,.7);
}
.x402id-root[data-theme="lime"] {
  --x-bg: #0c1206; --x-fg: #f1fbe3; --x-muted: #9aae82; --x-line: #26331a; --x-soft: #131c0b;
  --x-accent: #a3e635; --x-accent-fg: #0c1206; --x-tint: rgba(163,230,53,.12);
  --x-ok: #a3e635; --x-err: #fb7185; --x-shadow: 0 18px 40px -24px rgba(0,0,0,.7);
}
.x402id-root[data-theme="orange"] {
  --x-bg: #fffaf5; --x-fg: #1c1008; --x-muted: #7a5c45; --x-line: #f3d9c2; --x-soft: #fff0e2;
  --x-accent: #f97316; --x-accent-fg: #1c0a00; --x-tint: rgba(249,115,22,.12);
  --x-ok: #15803d; --x-err: #b91c1c; --x-shadow: 0 1px 2px rgba(120,53,15,.06), 0 18px 40px -24px rgba(120,53,15,.35);
}
.x402id-root[data-theme="purple"] {
  --x-bg: #120c1f; --x-fg: #f3efff; --x-muted: #a499c2; --x-line: #2d2244; --x-soft: #1a1230;
  --x-accent: #a78bfa; --x-accent-fg: #120c1f; --x-tint: rgba(167,139,250,.14);
  --x-ok: #86efac; --x-err: #fda4af; --x-shadow: 0 18px 40px -24px rgba(0,0,0,.7);
}
.x402id-head { display: flex; align-items: center; gap: 12px; margin: 0 0 18px; }
.x402id-logo { width: 36px; height: 36px; flex: none; display: block; }
.x402id-title { font-size: 16px; font-weight: 600; letter-spacing: -.01em; line-height: 1.2; }
.x402id-sub { font-size: 12px; color: var(--x-muted); margin-top: 2px; }
.x402id-label { font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--x-muted); margin: 0 0 8px; }
.x402id-ns { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; margin-bottom: 16px; }
.x402id-nsopt {
  display: flex; flex-direction: column; gap: 3px; text-align: left; cursor: pointer;
  padding: 10px 10px; border: 1px solid var(--x-line); border-radius: 10px;
  background: var(--x-soft); color: var(--x-fg); font: inherit;
  transition: border-color .15s ease, background .15s ease;
}
.x402id-nsopt:hover:not(:disabled) { border-color: var(--x-accent); }
.x402id-nsopt[aria-checked="true"] { border-color: var(--x-accent); background: var(--x-tint); box-shadow: inset 0 0 0 1px var(--x-accent); }
.x402id-nsopt:disabled { cursor: not-allowed; opacity: .6; }
.x402id-nsname { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; }
.x402id-nsdesc { font-size: 11px; color: var(--x-muted); }
.x402id-field {
  display: flex; align-items: center; border: 1px solid var(--x-line); border-radius: 10px;
  background: var(--x-bg); transition: border-color .15s ease, box-shadow .15s ease;
}
.x402id-field:focus-within { border-color: var(--x-accent); box-shadow: 0 0 0 3px var(--x-tint); }
.x402id-input { flex: 1; min-width: 0; padding: 11px 12px; border: 0; outline: none; font-size: 15px; background: transparent; color: inherit; font-family: inherit; }
.x402id-input::placeholder { color: var(--x-muted); opacity: .7; }
.x402id-suffix { padding: 0 12px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: var(--x-muted); white-space: nowrap; }
.x402id-btn {
  width: 100%; margin-top: 14px; padding: 12px 14px; border-radius: 10px; border: 0;
  background: var(--x-accent); color: var(--x-accent-fg); font-weight: 600; font-size: 15px; font-family: inherit;
  cursor: pointer; transition: filter .15s ease;
}
.x402id-btn:hover:not(:disabled) { filter: brightness(1.08); }
.x402id-btn:disabled { opacity: .5; cursor: not-allowed; }
.x402id-msg { font-size: 13px; margin-top: 8px; min-height: 18px; }
.x402id-err { color: var(--x-err); }
.x402id-ok  { color: var(--x-ok); }
.x402id-breakdown { margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: var(--x-soft); font-size: 13px; }
.x402id-line { display: flex; justify-content: space-between; margin: 4px 0; }
.x402id-line.tot { font-weight: 600; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--x-line); }
.x402id-muted { color: var(--x-muted); }
.x402id-link { color: inherit; text-decoration: underline; }
.x402id-foot { margin-top: 14px; font-size: 11px; color: var(--x-muted); text-align: center; }
.x402id-foot a { color: inherit; }
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
