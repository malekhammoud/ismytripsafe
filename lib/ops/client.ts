/**
 * Browser error reporter. Sends only the message, stack, route, and boundary name to
 * the app's same-origin intake route. No query strings, cookies, inputs, or storage.
 */

interface ClientEvent {
  message: string;
  stack?: string;
  boundary: string;
}

const seen = new Map<string, number>();
let installed = false;

function send(event: ClientEvent): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const key = `${event.boundary}|${event.message.slice(0, 300)}`;
  const previous = seen.get(key) ?? 0;
  if (now - previous < 30_000) return;
  seen.set(key, now);
  if (seen.size > 200) seen.clear();
  const payload = JSON.stringify({
    app: "ismytripsafe",
    message: event.message.slice(0, 2_000),
    stack: (event.stack ?? "").slice(0, 8_000),
    route: window.location.pathname,
    boundary: event.boundary,
    release: process.env.NEXT_PUBLIC_RELEASE ?? undefined,
    source: "client",
  });
  try {
    if ("sendBeacon" in navigator) {
      navigator.sendBeacon("/api/ops/report", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through
  }
  void fetch("/api/ops/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function reportClientError(error: unknown, boundary = "client"): void {
  if (error instanceof Error) {
    send({ message: error.message || error.name, stack: error.stack, boundary });
  } else {
    send({ message: String(error).slice(0, 2_000), boundary });
  }
}

export function installClientReporter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    reportClientError(event.error instanceof Error ? event.error : new Error(event.message), "window.error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), "unhandledrejection");
  });
}
