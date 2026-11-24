/**
 * Local health probe for the OpenCode Self worker.
 *
 * Requires the shared ops health token; the public web tier must never see this data.
 */

import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_DIR = process.env.REPORT_CACHE_DIR ?? "/var/lib/ismytripsafe/reports";
const REFDATA = "/var/lib/ismytripsafe/refdata.json";

async function writable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function readable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.OPS_HEALTH_TOKEN;
  if (expected !== undefined && expected.length > 0) {
    if (request.headers.get("x-ops-token") !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  const [reports, refdata] = await Promise.all([writable(REPORT_DIR), readable(REFDATA)]);
  const checks = {
    reportsDir: reports,
    refdata,
    researchConfigured: (process.env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_KEY ?? "").length > 0,
  };
  const ok = reports && refdata;
  return NextResponse.json(
    {
      ok,
      app: "ismytripsafe",
      release: process.env.DEPLOY_SHA ?? "",
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage().rss,
      checks,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
