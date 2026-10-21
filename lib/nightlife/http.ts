import { setTimeout as delay } from "node:timers/promises"
import { AsyncLocalStorage } from "node:async_hooks"
import { SourceHttpError } from "./source-errors"

const deadline = new AsyncLocalStorage<AbortSignal>()
export const withResearchDeadline = <T>(run: () => Promise<T>) => deadline.run(AbortSignal.timeout(240000), run)
export const researchSignal = () => deadline.getStore()
const USER_AGENT = "IsMyTripSafe-nightlife/1.1 (+https://ismytripsafe.com/about)"
type Policy = { timeoutMs?: number; retryDelayMs?: number; operation?: string; retries?: 0 | 1; fetch?: typeof fetch; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> }

function retryAfter(response: Response): number | null {
  const value = response.headers.get("retry-after")
  const seconds = value == null ? NaN : /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - Date.now()) / 1000
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null
}
const apiCode = (data: unknown): string | undefined => {
  const code = (data as { error?: { code?: unknown } })?.error?.code
  return typeof code === "string" && /^[a-z0-9_-]{1,48}$/i.test(code) ? code : undefined
}
async function errorCode(response: Response): Promise<string | undefined> {
  // Read a bounded JSON error, never an arbitrary HTML error page or raw body
  // into logs. Wikimedia also identifies replication lag with this header.
  const lag = response.headers.has("x-database-lag") ? "maxlag" : undefined
  if (!response.headers.get("content-type")?.includes("json") || !response.body) {
    void response.body?.cancel().catch(() => {}); return lag
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) return lag
      chunks.push(value)
    }
    return apiCode(JSON.parse(Buffer.concat(chunks).toString("utf8"))) ?? lag
  } catch { return lag }
  finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
}

// One bounded retry for timeouts, rate limits and upstream failures. Do not
// rotate public servers to evade a rate limit, or retry auth/validation errors.
export async function fetchJson<T>(url: string, options: RequestInit = {}, policy: Policy = {}): Promise<T> {
  const request = policy.fetch ?? fetch
  const sleep = policy.sleep ?? (async (ms, signal) => { await delay(ms, undefined, { signal }) })
  const headers = new Headers(options.headers)
  if (!headers.has("User-Agent")) headers.set("User-Agent", USER_AGENT)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")
  const outer = researchSignal()
  for (let attempt = 0; ; attempt++) {
    try {
      outer?.throwIfAborted()
      const signals = [AbortSignal.timeout(policy.timeoutMs ?? 20000), ...(options.signal ? [options.signal] : []), ...(outer ? [outer] : [])]
      const response = await request(url, { ...options, headers, signal: AbortSignal.any(signals) })
      if (!response.ok) {
        const code = await errorCode(response)
        throw new SourceHttpError(response.status, retryAfter(response) ?? (code === "maxlag" ? 5 : null), code, policy.operation)
      }
      const data = await response.json()
      // MediaWiki can return an error document with HTTP 200.
      if (data?.error) {
        const code = apiCode(data)
        throw new SourceHttpError(response.status, retryAfter(response) ?? (["maxlag", "ratelimited", "readonly"].includes(code ?? "") ? 5 : null), code, policy.operation)
      }
      return data as T
    } catch (error) {
      if (attempt >= (policy.retries ?? 1) || outer?.aborted || options.signal?.aborted) throw error
      if (error instanceof SourceHttpError && (!error.retryable || (error.retryAfter ?? 0) > 30)) throw error
      const wait = Math.max(policy.retryDelayMs ?? 1500, error instanceof SourceHttpError ? (error.retryAfter ?? 0) * 1000 : 0)
      await sleep(wait, outer ?? options.signal ?? undefined)
    }
  }
}
