import type { ReactNode } from "react"
import { LIGHTS } from "@/lib/lights"

/**
 * The three lamps, as one component so the home page and /how-it-works can't
 * drift apart. Two shapes, because the two places are not the same shape:
 *
 *  · **Side by side** (default) on the home page, where there is the full
 *    measure to put three colour blocks across.
 *  · **Stacked** in a document, where three blocks squeezed into a reading
 *    column turn into three narrow towers with the sentences wrapping every
 *    four words. There the colour becomes a rule down the left edge and the
 *    sentence gets the whole line — the signal survives, the cramping doesn't.
 *
 * `footer` is where the home page hangs its link through to the longer
 * explanation; /how-it-works has the explanation around it and passes nothing.
 */
export function StoplightStrip({
  stacked = false,
  footer,
}: {
  stacked?: boolean
  footer?: ReactNode
}) {
  if (stacked) {
    return (
      <>
        <ul className="space-y-2.5">
          {LIGHTS.map((l) => (
            <li
              key={l.label}
              className="rounded-[4px] py-2.5 pl-4 pr-3"
              style={{
                borderLeft: `3px solid ${l.ink}`,
                background: l.wash,
              }}
            >
              <p className="meta text-[0.62rem]" style={{ color: l.ink }}>
                {l.label}
              </p>
              <p className="mt-1 text-[0.94rem] leading-relaxed text-[var(--ink-soft)]">{l.body}</p>
            </li>
          ))}
        </ul>
        {footer}
      </>
    )
  }

  return (
    <>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {LIGHTS.map((l) => (
          <div key={l.label} className="light-card" style={{ background: l.color }}>
            {/* Mono: the label is the reading, not the prose. It also stops
                "Yellow light" wrapping onto two lines and leaving the three
                cards at three different heights. */}
            <p className="meta flex items-center gap-2 text-[0.62rem]">
              <span className="lamp" aria-hidden />
              {l.label}
            </p>
            <p className="mt-2.5 text-[0.85rem] leading-relaxed" style={{ color: "rgba(255,255,255,0.94)" }}>
              {l.body}
            </p>
          </div>
        ))}
      </div>
      {footer}
    </>
  )
}
