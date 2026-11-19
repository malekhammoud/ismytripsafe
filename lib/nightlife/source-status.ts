import type { VisitStatus } from "./visit-types"

export function sourceStatus(status: VisitStatus): string {
  if (!status.sourceFailures?.length) return `${status.failedSources?.join(" and ") || "A data source"} is temporarily unavailable.`
  return status.sourceFailures.map(failure => {
    const name = failure.name
    if (failure.kind === "busy") return `${name} asked us to wait while it is busy.`
    if (failure.kind === "rate_limit") return `${name} asked us to slow down. We’ll respect its retry time.`
    if (failure.kind === "timeout") return `${name} didn’t respond in time.`
    if (failure.kind === "connection") return `The connection to ${name} failed.`
    if (failure.kind === "unavailable") return `${name} is temporarily unavailable${failure.status ? ` (HTTP ${failure.status})` : ""}.`
    return `${name} couldn’t complete the lookup${failure.status ? ` (HTTP ${failure.status})` : ""}.`
  }).join(" ")
}
