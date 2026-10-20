export class SourceUnavailable extends Error {}
export class SourceHttpError extends Error {
  constructor(public status: number, public retryAfter: number | null = null, public code?: string, public operation?: string) {
    super(`${operation ? `${operation}: ` : ""}Source returned HTTP ${status}${code ? ` (${code})` : ""}`)
  }
  get retryable() { return ["maxlag", "ratelimited", "readonly"].includes(this.code ?? "") || [408, 429, 500, 502, 503, 504].includes(this.status) }
}

export interface SourceFailure {
  kind: "busy" | "rate_limit" | "unavailable" | "timeout" | "connection" | "request"
  status?: number
  code?: string
  operation?: string
  retryAt?: string
}
// Keep diagnostics useful without publishing response bodies or credential URLs.
export function sourceFailure(error: unknown): SourceFailure {
  if (error instanceof SourceHttpError) return {
    kind: error.code === "ratelimited" || error.status === 429 ? "rate_limit" : ["maxlag", "readonly"].includes(error.code ?? "") ? "busy" : error.status >= 500 ? "unavailable" : error.status === 408 ? "timeout" : "request",
    status: error.status, code: error.code, operation: error.operation,
    ...(error.retryAfter != null ? { retryAt: new Date(Date.now() + error.retryAfter * 1000).toISOString() } : {}),
  }
  return { kind: error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "timeout" : error instanceof TypeError ? "connection" : "request" }
}
