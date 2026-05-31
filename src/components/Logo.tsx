// Flashbang mark — a sharp burst of light. A bold 4-point flash (the "flash")
// with short diagonal sparks (the "bang"). Filled so it reads at any size.
// Defaults to the accent colour; pass a color to override (e.g. for the tile).
export function Logo({ size = 64, color = 'var(--accent)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ color }}>
      {/* main 4-point flash */}
      <path
        d="M32 3 L37 27 L61 32 L37 37 L32 61 L27 37 L3 32 L27 27 Z"
        fill="currentColor"
      />
      {/* diagonal sparks */}
      <g stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" opacity={0.5}>
        <line x1="46" y1="18" x2="51.5" y2="12.5" />
        <line x1="18" y1="18" x2="12.5" y2="12.5" />
        <line x1="46" y1="46" x2="51.5" y2="51.5" />
        <line x1="18" y1="46" x2="12.5" y2="51.5" />
      </g>
    </svg>
  )
}
