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
  provider?: string
  elapsedMs?: number
}
export class SourceOperationError extends Error {
  readonly failure: SourceFailure
  constructor(error: unknown, operation: string, provider: string, elapsedMs: number) {
    const failure = { ...sourceFailure(error), operation, provider, elapsedMs }
    super(`${operation}: ${failure.kind}${failure.status ? ` HTTP ${failure.status}` : ""}${failure.code ? ` (${failure.code})` : ""} after ${elapsedMs}ms via ${provider}`)
    this.failure = failure
  }
}
// Keep diagnostics useful without publishing response bodies or credential URLs.
export function sourceFailure(error: unknown): SourceFailure {
  if (error instanceof SourceOperationError) return error.failure
  if (error instanceof SourceHttpError) return {
    kind: error.code === "ratelimited" || error.status === 429 ? "rate_limit" : ["maxlag", "readonly"].includes(error.code ?? "") ? "busy" : error.status >= 500 ? "unavailable" : error.status === 408 ? "timeout" : "request",
    status: error.status, code: error.code, operation: error.operation,
    ...(error.retryAfter != null ? { retryAt: new Date(Date.now() + error.retryAfter * 1000).toISOString() } : {}),
  }
  const code = (error as { cause?: { code?: unknown } })?.cause?.code
  const networkCode = typeof code === "string" && /^[A-Z0-9_]{1,48}$/.test(code) ? code : undefined
  return { kind: error instanceof Error && (["TimeoutError", "AbortError"].includes(error.name) || networkCode?.includes("TIMEOUT")) ? "timeout" : error instanceof TypeError ? "connection" : "request", ...(networkCode ? { code: networkCode } : {}) }
}
