// The logo's X mark, minus its tile. Geometry matches public/favicon.svg.
const ARMS: [number, number, number, number][] = [
  [18, 18, 26.5, 26.5],
  [46, 18, 37.5, 26.5],
  [18, 46, 26.5, 37.5],
  [46, 46, 37.5, 37.5],
];

/** Inline mark that stands in for the "x" in "x402" inside a heading. */
export function InlineX() {
  return (
    <svg className="inline-x" viewBox="14 14 36 36" role="img" aria-label="x">
      <g stroke="currentColor" strokeWidth="7.5" strokeLinecap="round">
        {ARMS.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <polygon points="32,25 39,32 32,39 25,32" fill="var(--accent)" />
    </svg>
  );
}

/** Giant cropped mark behind a hero. The parent needs position:relative + overflow:hidden. */
export function BackgroundX() {
  return (
    <div className="bg-x" aria-hidden="true">
      <svg viewBox="14 14 36 36" width="100%" height="100%">
        <defs>
          <linearGradient id="bgx" x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: "var(--bgx-1)" }} />
            <stop offset=".45" style={{ stopColor: "var(--bgx-2)" }} />
            <stop offset=".7" style={{ stopColor: "var(--bgx-3)" }} />
            <stop offset="1" style={{ stopColor: "var(--bgx-4)" }} />
          </linearGradient>
        </defs>
        <g stroke="url(#bgx)" strokeWidth="7" strokeLinecap="round">
          {ARMS.map(([x1, y1, x2, y2]) => (
            <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
        <polygon points="32,25.5 38.5,32 32,38.5 25.5,32" fill="var(--accent)" />
      </svg>
    </div>
  );
}
