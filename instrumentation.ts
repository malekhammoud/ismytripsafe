/**
 * Next.js server instrumentation.
 *
 * Registers process-level reporting and forwards every route/render/action error that
 * Next catches to the OpenCode Self control plane. The reporting path is fail-open.
 */

import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { installServerHooks } = await import("./lib/ops/server");
  installServerHooks();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerEvent } = await import("./lib/ops/server");
  const header = request.headers["x-request-id"];
  const requestId = Array.isArray(header) ? header[0] : header;
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = typeof (error as { digest?: unknown }).digest === "string"
    ? (error as { digest: string }).digest
    : undefined;
  reportServerEvent({
    source: `next.${context.routeType}`,
    severity: "error",
    message: err.message || err.name,
    stack: err.stack,
    route: request.path,
    method: request.method,
    status: 500,
    requestId,
    context: {
      digest,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  });
};
