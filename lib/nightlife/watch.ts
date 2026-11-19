import type { VisitStatus } from "./visit-types"

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return }
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve() }, ms)
  const abort = () => { clearTimeout(timer); reject(signal.reason) }
  signal.addEventListener("abort", abort, { once: true })
})
interface Options {
  endpoint: string
  mode: "page" | "teaser" | "refresh"
  signal: AbortSignal
  onStatus: (status: VisitStatus) => void
  onReport: () => void
  onSlow: () => void
  fetcher?: typeof fetch
  sleep?: typeof wait
  now?: () => number
}
const states = new Set(["idle", "running", "ready", "unavailable", "failed", "busy", "deferred"])

// Kept separate from React so reconnects, cooldowns and navigation cancellation
// are exercised against the actual browser polling logic.
export async function watchNightlife({ endpoint, mode, signal, onStatus, onReport, onSlow, fetcher = fetch, sleep = wait, now = Date.now }: Options) {
  let start = true, errors = 0, worked = false, began = now(), automaticRetry = false
  while (!signal.aborted) {
    try {
      const response = await fetcher(endpoint, { method: start ? "POST" : "GET", signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), cache: "no-store" })
      if (!response.ok) {
        if ([400, 403, 404].includes(response.status)) {
          onStatus({ state: "failed", available: mode === "refresh", issue: "service" })
          return
        }
        throw new Error("Status request failed")
      }
      const status = await response.json() as VisitStatus
      if (!states.has(status.state) || typeof status.available !== "boolean") throw new Error("Invalid status response")
      if (signal.aborted) return
      errors = 0
      onStatus({ ...status, retryScheduled: status.state === "failed" && !automaticRetry && !!status.retryAfter && status.retryAfter <= 600 })
      if (status.state === "running" || status.state === "busy") worked = true
      const done = ["ready", "unavailable", "failed", "deferred"].includes(status.state)
      if (status.available && (mode !== "refresh" || (worked && done))) { onReport(); return }
      if (status.state === "failed") {
        // One automatic retry, at the server's real cooldown. The user sees
        // when it will happen; clicking a button cannot silently defeat it.
        if (automaticRetry || !status.retryAfter || status.retryAfter > 600) return
        await sleep(status.retryAfter * 1000, signal)
        automaticRetry = true
        start = true
        began = now()
        continue
      }
      if (done) return
      if (now() - began >= 5 * 60000) { onSlow(); return }
      start = status.state === "idle" || status.state === "busy"
      await sleep(Math.max(2000, Math.min(10000, (status.retryAfter ?? 3) * 1000)), signal)
    } catch {
      if (signal.aborted) return
      if (++errors > 3) { onStatus({ state: "failed", available: mode === "refresh", issue: "connection" }); return }
      await sleep([2000, 5000, 10000][errors - 1], signal).catch(() => {})
      // If a POST response was lost, its job may already exist. GET discovers
      // that job first; an idle response will schedule a new POST safely.
      start = false
    }
  }
}
