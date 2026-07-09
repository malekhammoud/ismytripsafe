"use client"

import { ExternalLink } from "lucide-react"

export function SourceLink({
  href,
  label = "source",
  color = "var(--ink-faint)",
  className = "",
}: {
  href: string
  label?: string
  color?: string
  className?: string
}) {
  const external = /^https?:\/\//i.test(href)
  return (
    <a
      href={href}
      aria-label={`Open ${label} source`}
      title={`Open ${label} source`}
      className={`inline-flex items-center align-middle opacity-80 transition-opacity hover:opacity-100 ${className}`}
      style={{ color }}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink size={11} strokeWidth={2.2} />
    </a>
  )
}
