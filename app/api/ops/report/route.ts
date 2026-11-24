/**
 * Same-origin browser error intake.
 *
 * The browser never holds the control-plane token. This route accepts a small,
 * same-origin payload, rate-limits it, and forwards it to the local control plane.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const buckets = new Map<string, number[]>();

function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf !== null && cf.length > 0) return cf.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded.length > 0) return forwarded.split(",")[0].trim().slice(0, 64);
  return request.headers.get("x-real-ip") ?? "unknown";
}

function allowed(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    buckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  buckets.set(ip, recent);
  if (buckets.size > 10_000) buckets.clear();
  return false;
}

export async function POST(request: Request): Promise<Response> {
  if (!allowed(request)) return new NextResponse(null, { status: 403 });
  if (rateLimited(clientIp(request))) return new NextResponse(null, { status: 429 });
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 12_000) return new NextResponse(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (body === null || typeof body !== "object") return new NextResponse(null, { status: 400 });
  const source = body as Record<string, unknown>;
  const message = typeof source.message === "string" ? source.message.slice(0, 2_000) : "";
  if (message.length === 0) return new NextResponse(null, { status: 400 });
  const endpoint = process.env.OPS_INGEST_URL ?? "http://127.0.0.1:3100";
  const token = process.env.OPS_INGEST_TOKEN ?? "";
  if (token.length > 0) {
    void fetch(`${endpoint}/api/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": token },
      body: JSON.stringify({
        app: "ismytripsafe",
        source: "client",
        severity: "error",
        message,
        stack: typeof source.stack === "string" ? source.stack.slice(0, 8_000) : "",
        route: typeof source.route === "string" ? source.route.split("?")[0].slice(0, 180) : "",
        release: typeof source.release === "string" ? source.release.slice(0, 80) : undefined,
        context: { boundary: typeof source.boundary === "string" ? source.boundary.slice(0, 60) : "client" },
      }),
      signal: AbortSignal.timeout(2_000),
    }).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
