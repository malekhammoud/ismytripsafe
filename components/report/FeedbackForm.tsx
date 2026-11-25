"use client"

import { useState } from "react"
import { Star, CheckCircle2 } from "lucide-react"
import { capture } from "@/lib/analytics"

type Category = "bug" | "feature" | "other"

const CATEGORY_LABELS: { id: Category; label: string }[] = [
  { id: "bug", label: "Something's broken" },
  { id: "feature", label: "Feature idea" },
  { id: "other", label: "Other" },
]

function actorId(): string {
  try {
    const key = "imts.feedbackActor"
    const existing = window.localStorage.getItem(key)
    if (existing !== null && existing.length >= 8) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(key, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * "Was this report helpful?" — a 5-star rating, a feedback type, and an optional
 * comment at the bottom of every report. The route keeps a local JSONL audit trail
 * and forwards only sanitized product feedback to OpenCode Self.
 */
export function FeedbackForm({ place, page }: { place: string; page?: string }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [category, setCategory] = useState<Category>("other")
  const [comment, setComment] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")

  const submit = async () => {
    if ((rating === 0 && comment.trim().length < 3) || state === "sending") return
    setState("sending")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          category,
          comment,
          place,
          page,
          actorId: actorId(),
          release: process.env.NEXT_PUBLIC_RELEASE,
        }),
      })
      if (res.ok) {
        capture("feedback_submitted", {
          category,
          rating,
          has_comment: comment.trim().length > 0,
          page: page ?? window.location.pathname,
        })
      }
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
          <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Feedback type">
            {CATEGORY_LABELS.map((item) => {
              const on = category === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCategory(item.id)}
                  className="rounded-full border px-2.5 py-1 text-[0.72rem] font-medium transition-colors"
                  style={{
                    borderColor: on ? "var(--accent)" : "var(--hairline)",
                    color: on ? "var(--accent-deep)" : "var(--ink-soft)",
                    background: on ? "rgba(232,161,58,0.12)" : "transparent",
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
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
                onClick={() => {
                  setRating(n)
                  if (n <= 2 && category === "other") setCategory("bug")
                }}
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
            placeholder="What should we fix or add? (optional)"
            className="field mt-2.5 w-full resize-none rounded-[3px] bg-white/70 px-3 py-2 text-[0.85rem]"
            style={{ borderColor: "var(--hairline)" }}
          />
          <p className="mt-1.5 text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
            Please don&apos;t include personal details. We read every note and look for patterns across reports.
          </p>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={(rating === 0 && comment.trim().length < 3) || state === "sending"}
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
