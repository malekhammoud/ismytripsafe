"use client"

import { useState } from "react"

// ─────────────────────────────────────────────────────────────────────
// A photograph with somewhere to fall back to.
//
// Destination photos are hotlinked from Wikimedia, which is generous but
// not infallible: a file can be deleted or renamed, and the thumbnailer
// refuses most widths outright (see `sized` in lib/photos.ts). So each
// image gets a chain — the sized rendition, then the untouched original,
// then a photograph from the house set — and a card is never left showing
// a broken-image icon.
//
// A client component purely for the error handler; everything around it
// stays server-rendered.
// ─────────────────────────────────────────────────────────────────────

export function Photo({
  src,
  original,
  fallback,
  alt,
  className,
  width,
  height,
  priority = false,
}: {
  src: string
  /** The un-resized URL, tried if the sized one fails. */
  original?: string | null
  /** A local photo that is always there. */
  fallback: string
  alt: string
  className?: string
  width?: number
  height?: number
  priority?: boolean
}) {
  const [step, setStep] = useState(0)
  const chain = [src, ...(original && original !== src ? [original] : []), fallback]
  const current = chain[Math.min(step, chain.length - 1)]

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...(priority ? ({ fetchPriority: "high" } as any) : {})}
      decoding="async"
      onError={() => setStep((s) => (s < chain.length - 1 ? s + 1 : s))}
    />
  )
}
