"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, MessageSquare, Star, X } from "lucide-react"

type Category = "bug" | "feature" | "other"

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
 * Site-wide feedback prompt. The report page also has an inline form; this is for
 * the home, destination, methodology, and nightlife pages.
 */
export function FeedbackButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>("other")
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

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
          page: window.location.pathname,
          actorId: actorId(),
          release: process.env.NEXT_PUBLIC_RELEASE,
        }),
      })
      setState(res.ok ? "done" : "error")
    } catch {
      setState("error")
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--accent-deep)] hover:underline ${className}`}
      >
        <MessageSquare size={13} strokeWidth={2.2} />
        Feedback
      </button>
      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="imts-feedback-title"
            className="w-full max-w-md rounded-[4px] border bg-[var(--paper)] p-5 shadow-xl"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="imts-feedback-title" className="text-[1rem] font-semibold" style={{ color: "var(--ink)" }}>
                  Tell us what to improve
                </h2>
                <p className="mt-1 text-[0.78rem]" style={{ color: "var(--ink-soft)" }}>
                  Bug reports and repeated feature requests shape what we build. Please don&apos;t include personal details.
                </p>
              </div>
              <button type="button" aria-label="Close feedback" onClick={() => setOpen(false)} className="rounded p-1" style={{ color: "var(--ink-faint)" }}>
                <X size={18} />
              </button>
            </div>
            {state === "done" ? (
              <div className="mt-4 flex items-center gap-2 text-[0.9rem] font-semibold" style={{ color: "var(--ink)" }}>
                <CheckCircle2 size={17} style={{ color: "var(--accent)" }} />
                Thank you — we read every note.
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Feedback type">
                  {([
                    ["bug", "Something's broken"],
                    ["feature", "Feature idea"],
                    ["other", "Other"],
                  ] as const).map(([id, label]) => {
                    const on = category === id
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setCategory(id)}
                        className="rounded-full border px-2.5 py-1 text-[0.72rem] font-medium"
                        style={{
                          borderColor: on ? "var(--accent)" : "var(--hairline)",
                          color: on ? "var(--accent-deep)" : "var(--ink-soft)",
                          background: on ? "rgba(232,161,58,0.12)" : "transparent",
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rate the site">
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
                      className="rounded-md p-1"
                      style={{ color: rating >= n ? "#e8a13a" : "var(--ink-faint)" }}
                    >
                      <Star size={20} fill={rating >= n ? "#e8a13a" : "none"} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="What is broken, missing, or confusing?"
                  className="field mt-2 w-full resize-none rounded-[3px] bg-white/70 px-3 py-2 text-[0.85rem]"
                  style={{ borderColor: "var(--hairline)" }}
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={(rating === 0 && comment.trim().length < 3) || state === "sending"}
                    className="btn px-4 py-1.5 text-[0.82rem] font-semibold"
                  >
                    {state === "sending" ? "Sending…" : "Send feedback"}
                  </button>
                  {state === "error" ? <span className="text-[0.75rem]" style={{ color: "var(--risky)" }}>Couldn&apos;t send.</span> : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
