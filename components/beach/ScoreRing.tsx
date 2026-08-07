/**
 * A 0–100 score as a ring, on paper.
 *
 * The report has its own ring, but it is welded to the dark report chrome —
 * a translucent white track, a glow, and an indeterminate state for a score
 * still being computed. None of that belongs on cream, so this is its own
 * twelve lines rather than a prop-riddled version of that one.
 *
 * Server-rendered on purpose: it is the number the whole page is about, so it
 * should be in the HTML, not painted in after hydration.
 */
export function ScoreRing({
  score,
  color,
  size = 132,
  stroke = 7,
  track = "rgba(29,47,56,0.13)",
  label = "/ 100",
  onDark = false,
  spin = 0,
}: {
  score: number
  color: string
  size?: number
  stroke?: number
  /** The unfilled arc. Lighten it when the ring sits over a photograph. */
  track?: string
  label?: string
  /** Type inside the ring flips to paper-white over dark art. */
  onDark?: boolean
  /**
   * Extra degrees to roll the whole ring by. The arc starts at twelve o'clock
   * and fills clockwise, which puts the unfilled gap at the top *left*; the
   * header comp has it at the top right, and it is one number to say so.
   */
  spin?: number
}) {
  const R = 54
  const C = 2 * Math.PI * R
  const filled = (Math.max(0, Math.min(100, score)) / 100) * C
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full"
        style={{ transform: `rotate(${spin - 90}deg)` }}
        aria-hidden
      >
        <circle cx="60" cy="60" r={R} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${C}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display tnum font-medium leading-none"
          style={{
            fontSize: size * 0.315,
            color: onDark ? "#fffdf6" : "var(--navy)",
            textShadow: onDark ? "0 2px 10px rgba(9,32,44,0.5)" : undefined,
          }}
        >
          {score}
        </span>
        <span
          className="tnum mt-1 font-semibold uppercase tracking-[0.12em]"
          style={{
            fontSize: Math.max(8, size * 0.072),
            color: onDark ? "rgba(255,253,246,0.78)" : "var(--ink-faint)",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
