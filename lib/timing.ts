// ─────────────────────────────────────────────────────────────────────
// Stage timing, off unless TIMING=1 is set. The report pipeline fans out over
// ~40 upstream calls across three stages; when it gets slow, "which stage"
// is the only question worth asking, and guessing at it wastes more time than
// the logging costs. See scripts/bench-report.mjs for the harness that reads
// these.
// ─────────────────────────────────────────────────────────────────────

const ON = !!process.env.TIMING

export function timeLog(label: string, ms: number, extra = ""): void {
  if (ON) console.log(`[timing] ${label} ${Math.round(ms)}ms ${extra}`)
}

/** Wrap a promise so TIMING=1 reports what that stage actually cost. */
export async function timed<T>(label: string, p: Promise<T>): Promise<T> {
  if (!ON) return p
  const t = Date.now()
  try {
    return await p
  } finally {
    timeLog(label, Date.now() - t)
  }
}

/**
 * Resolve `p`, or null if it takes longer than `ms`.
 *
 * A per-request timeout is not the same thing as a budget: a source with a
 * retry ladder can honour every individual timeout and still take their sum.
 * This is the hard wall-clock ceiling. The underlying work is left running on
 * purpose — for anything backed by the warm store, it still lands in time to
 * serve the next report.
 */
export function withBudget<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms)
    }),
  ])
}
