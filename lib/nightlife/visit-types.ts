export type BuildPhase = "resolve" | "venues" | "details" | "score"
export type VisitState = "idle" | "running" | "ready" | "unavailable" | "failed" | "busy" | "deferred"
export interface VisitStatus {
  state: VisitState
  available: boolean
  phase?: BuildPhase
  retryAfter?: number
  updatedAt?: string
  retryAt?: string
  issue?: "sources" | "city" | "boundary" | "evidence" | "connection" | "service"
  failedSources?: string[]
  venueCount?: number
  scoreCount?: number
  retryScheduled?: boolean
}
