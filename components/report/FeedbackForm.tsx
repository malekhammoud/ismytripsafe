"use client"

import { useState } from "react"
import { Star, CheckCircle2 } from "lucide-react"

/**
 * "Was this report helpful?" — a 5-star rating plus an optional comment, at
 * the bottom of every report. Submissions are appended to a JSONL store
 * server-side (/api/feedback, best-effort; never blocks or errors the page).
 */
export function FeedbackForm({ place, page }: { place: string; page?: string }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")

  const submit = async () => {
    if (rating === 0 || state === "sending") return
    setState("sending")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, place, page }),
      })
      setState(res.ok ? "done" : "error")
    } catch {
      setState("error")
    }
  }

  return (
    <div
      className="mx-5 mt-6 rounded-[3px] border px-5 py-4 sm:mx-7 sm:px-7"
      style={{ background: "rgba(255,255,255,0.5)", borderColor: "var(--hairline)" }}
    >
      {state === "done" ? (
        <div className="flex items-center gap-2.5 text-[0.9rem] font-semibold" style={{ color: "var(--ink)" }}>
          <CheckCircle2 size={17} style={{ color: "var(--accent)" }} />
          Thanks — your feedback helps us make better reports.
        </div>
      ) : (
        <>
          <p className="text-[0.95rem] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
            Was this {place ? `${place} ` : ""}report helpful?
          </p>
          <div
            className="mt-2 flex items-center gap-1"
            role="radiogroup"
            aria-label="Rate this report"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                className="rounded-md p-1 transition-transform hover:scale-110"
                style={{ color: (hover || rating) >= n ? "#e8a13a" : "var(--ink-faint)" }}
              >
                <Star size={22} strokeWidth={2} fill={(hover || rating) >= n ? "#e8a13a" : "none"} />
              </button>
            ))}
            <span className="ml-2 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
              {rating === 5 ? "Loved it" : rating === 4 ? "Helpful" : rating === 3 ? "Okay" : rating === 2 ? "Not great" : rating === 1 ? "Not helpful" : ""}
            </span>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Anything we should improve? (optional)"
            className="field mt-2.5 w-full resize-none rounded-[3px] bg-white/70 px-3 py-2 text-[0.85rem]"
            style={{ borderColor: "var(--hairline)" }}
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={rating === 0 || state === "sending"}
              className="btn px-4 py-1.5 text-[0.82rem] font-semibold"
            >
              {state === "sending" ? "Sending…" : "Send feedback"}
            </button>
            {state === "error" && (
              <p className="text-[0.75rem]" style={{ color: "var(--risky)" }}>
                Couldn&apos;t send — please try again.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}