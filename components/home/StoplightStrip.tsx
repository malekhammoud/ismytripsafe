import type { ReactNode } from "react"
import { LIGHTS } from "@/lib/lights"

/**
 * The three lamps, as one component so the homepage and /how-it-works can't
 * drift apart. `footer` is where the homepage hangs its link through to the
 * longer explanation; /how-it-works has the explanation around it already and
 * passes nothing.
 */
export function StoplightStrip({ footer }: { footer?: ReactNode }) {
  return (
    <>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {LIGHTS.map((l) => (
          <div key={l.label} className="light-card" style={{ background: l.color }}>
            <p className="flex items-center gap-2 text-[0.82rem] font-bold uppercase tracking-[0.08em]">
              <span className="lamp" aria-hidden />
              {l.label}
            </p>
            <p className="mt-2 text-[0.8rem] leading-relaxed" style={{ color: "rgba(255,255,255,0.94)" }}>
              {l.body}
            </p>
          </div>
        ))}
      </div>
      {footer}
    </>
  )
}
