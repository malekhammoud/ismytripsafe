import { setTimeout as delay } from "node:timers/promises"
import { AsyncLocalStorage } from "node:async_hooks"
import { SourceHttpError } from "./source-errors"

const deadline = new AsyncLocalStorage<AbortSignal>()
export const withResearchDeadline = <T>(run: () => Promise<T>) => deadline.run(AbortSignal.timeout(240000), run)
export const researchSignal = () => deadline.getStore()
const USER_AGENT = "IsMyTripSafe-nightlife/1.1 (+https://ismytripsafe.com/about)"
type Policy = { timeoutMs?: number; retryDelayMs?: number; fetch?: typeof fetch; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> }

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
        const retry = response.headers.get("retry-after")
        const seconds = retry == null ? NaN : /^\d+$/.test(retry) ? Number(retry) : (Date.parse(retry) - Date.now()) / 1000
        await response.body?.cancel()
        throw new SourceHttpError(response.status, Number.isFinite(seconds) ? Math.max(0, seconds) : null)
      }
      const data = await response.json()
      // MediaWiki can return an error document with HTTP 200.
      if (data?.error) {
        if (["maxlag", "ratelimited", "readonly"].includes(data.error.code)) throw new SourceHttpError(503, 5)
        throw new SourceHttpError(400)
      }
      return data as T
    } catch (error) {
      if (attempt >= 1 || outer?.aborted || options.signal?.aborted) throw error
      if (error instanceof SourceHttpError && (![408, 429, 500, 502, 503, 504].includes(error.status) || (error.retryAfter ?? 0) > 30)) throw error
      const wait = Math.max(policy.retryDelayMs ?? 1500, error instanceof SourceHttpError ? (error.retryAfter ?? 0) * 1000 : 0)
      await sleep(wait, outer ?? options.signal ?? undefined)
    }
  }
}
