"use client"

import { useState, useRef, useEffect } from "react"
import { Info } from "lucide-react"

/**
 * A small "i" bubble that explains a term. Reveals on hover (desktop) and on
 * click/tap (touch). Used across the report to demystify every metric.
 */
export function InfoTip({
  text,
  label = "What this means",
  color = "#141922",
  align = "center",
}: {
  text: string
  label?: string
  color?: string
  align?: "left" | "center" | "right"
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const pos =
    align === "left"
      ? { left: 0 }
      : align === "right"
        ? { right: 0 }
        : { left: "50%", transform: "translateX(-50%)" }

  return (
    <span ref={ref} className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full opacity-55 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
        style={{ color }}
      >
        <Info size={12} strokeWidth={2.4} />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-[calc(100%+7px)] z-30 w-[220px] rounded-[6px] px-3 py-2 text-[0.72rem] font-normal leading-snug shadow-[var(--shadow-float)] transition-opacity duration-150 group-hover:opacity-100 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        style={{
          ...pos,
          background: "#ffffff",
          color: "var(--ink-soft)",
          border: "1px solid var(--hairline)",
          letterSpacing: 0,
          textTransform: "none",
        }}
      >
        {text}
      </span>
    </span>
  )
}
