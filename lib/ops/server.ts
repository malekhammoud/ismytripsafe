/**
 * Server-side error reporter for the OpenCode Self control plane.
 *
 * Fire-and-forget, deduplicated, and fail-open. It never logs credentials, request
 * bodies, cookies, or query strings.
 */

interface OpsEvent {
  source: string;
  severity?: "critical" | "error" | "warning" | "info";
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  status?: number;
  requestId?: string;
  context?: Record<string, unknown>;
}

const ENDPOINT = process.env.OPS_INGEST_URL ?? "http://127.0.0.1:3100";
const TOKEN = process.env.OPS_INGEST_TOKEN ?? "";
const ENABLED = process.env.OPS_REPORTING !== "0" && TOKEN.length > 0;
const seen = new Map<string, number>();
let installed = false;

function keyOf(event: OpsEvent): string {
  return `${event.source}|${event.route ?? ""}|${event.message.slice(0, 300)}`.slice(0, 500);
}

export function reportServerEvent(event: OpsEvent): void {
  if (!ENABLED) return;
  const now = Date.now();
  const key = keyOf(event);
  const previous = seen.get(key) ?? 0;
  if (now - previous < 30_000) return;
  seen.set(key, now);
  if (seen.size > 1_000) seen.clear();
  const payload = {
    app: "ismytripsafe",
    source: event.source.slice(0, 120),
    severity: event.severity ?? "error",
    message: event.message.slice(0, 2_000),
    stack: (event.stack ?? "").slice(0, 8_000),
    route: (event.route ?? "").split("?")[0].slice(0, 180),
    method: event.method,
    status: event.status,
    release: process.env.DEPLOY_SHA ?? process.env.NEXT_PUBLIC_RELEASE ?? undefined,
    request_id: event.requestId,
    context: event.context,
  };
  void fetch(`${ENDPOINT}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ops-token": TOKEN },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(2_500),
  }).catch(() => {
    // Monitoring must never break the request path.
  });
}

export function installServerHooks(): void {
  if (installed || typeof process === "undefined") return;
  installed = true;
  process.on("uncaughtExceptionMonitor", (error) => {
    reportServerEvent({
      source: "process.uncaughtException",
      severity: "critical",
      message: error.message,
      stack: error.stack,
    });
  });
}
