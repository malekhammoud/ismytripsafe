"use client";

/**
 * Privacy-safe PostHog analytics for IsMyTripSafe.
 *
 * The product handles health-adjacent travel profiles. We therefore never send
 * query strings, profile fields, free text, account ids, or report contents.
 * Only explicit, low-cardinality events and public page paths leave the browser.
 */

import type { CaptureResult, PostHog } from "posthog-js";

const PRODUCT = "ismytripsafe";
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  "phc_BL8wa5sXcYHPTNHbDsxfXiQHTZSgxBZ9UCrSZfPyM7cB";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";

const SENSITIVE_KEY =
  /(^|_|\$)(email|phone|address|name|condition|diagnosis|medication|symptom|health|trip|itinerary|place|party|age|gender|style|comment|message|query|token|secret|password|cookie|user|account)$/i;
const PATH_KEYS = /(page|path|url|referr?er|href)/i;
const SAFE_SYSTEM_KEY = new Set(["$current_url", "$pathname", "$referrer", "$referring_domain"]);
const MAX_QUEUE = 40;
const GLOBAL_CLIENT_KEY = "__ismytripsafePosthog";
const GLOBAL_QUEUE_KEY = "__ismytripsafeGrowthQueue";

type AnalyticsProps = Record<string, unknown>;
type QueuedEvent = { event: string; props: AnalyticsProps };

let client: PostHog | null = null;
let starting: Promise<PostHog | null> | null = null;
let lastPageview = { path: "", at: 0 };
let scrollMarks = new Set<number>();
let scrollQueued = false;

function stripPath(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    return url.pathname.slice(0, 300);
  } catch {
    return value.split("?")[0].split("#")[0].slice(0, 300);
  }
}

function stripUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return value.split("?")[0].split("#")[0].slice(0, 300);
  }
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    if (key === "page" || key === "path" || key === "$pathname" || key === "href_path") return stripPath(value);
    if (PATH_KEYS.test(key)) return stripUrl(value);
    return value.slice(0, 300);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => (typeof item === "string" ? item.slice(0, 120) : typeof item === "number" || typeof item === "boolean" ? item : null))
      .filter((item) => item !== null);
  }
  if (typeof value === "object" && depth < 2) {
    return sanitizeProps(value as AnalyticsProps, depth + 1);
  }
  return undefined;
}

export function sanitizeProps(input: AnalyticsProps = {}, depth = 0): AnalyticsProps {
  const output: AnalyticsProps = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key) && !SAFE_SYSTEM_KEY.has(key)) continue;
    const clean = sanitizeValue(key, value, depth);
    if (clean !== undefined) output[key] = clean;
  }
  return output;
}

function safePath(path: string): string {
  const clean = path.split("?")[0].split("#")[0] || "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function page(): string {
  return safePath(window.location.pathname);
}

function sharedWindow(): Window & Record<string, unknown> {
  return window as unknown as Window & Record<string, unknown>;
}

function sharedClient(): PostHog | null {
  if (client) return client;
  const candidate = sharedWindow()[GLOBAL_CLIENT_KEY];
  return candidate && typeof (candidate as PostHog).capture === "function" ? (candidate as PostHog) : null;
}

function sharedQueue(): QueuedEvent[] {
  const w = sharedWindow();
  if (!Array.isArray(w[GLOBAL_QUEUE_KEY])) w[GLOBAL_QUEUE_KEY] = [];
  return w[GLOBAL_QUEUE_KEY] as QueuedEvent[];
}

function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  const properties = (event.properties && typeof event.properties === "object"
    ? event.properties
    : {}) as Record<string, unknown>;
  delete properties.$set;
  delete properties.$set_once;
  delete properties.$ip;
  delete properties.$search;
  for (const key of Object.keys(properties)) {
    if (SENSITIVE_KEY.test(key) && !SAFE_SYSTEM_KEY.has(key)) {
      delete properties[key];
      continue;
    }
    if (typeof properties[key] === "string" && (key === "page" || key === "path" || key === "$pathname" || key === "href_path")) {
      properties[key] = stripPath(properties[key] as string);
    } else if (PATH_KEYS.test(key) && typeof properties[key] === "string") {
      properties[key] = stripUrl(properties[key] as string);
    }
  }
  event.properties = properties as CaptureResult["properties"];
  return event;
}

async function start(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  const existing = sharedClient();
  if (existing) {
    client = existing;
    return existing;
  }
  if (starting) return starting;
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (privacy.doNotTrack === "1" || privacy.globalPrivacyControl === true) return null;
  starting = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        ui_host: "https://us.posthog.com",
        defaults: "2026-06-25",
        person_profiles: "identified_only",
        persistence: "localStorage",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: true,
        capture_exceptions: false,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        disable_session_recording: true,
        enable_recording_console_log: false,
        session_recording: {
          maskAllInputs: true,
        },
        capture_performance: { web_vitals: true, network_timing: false },
        respect_dnt: true,
        before_send: beforeSend,
      });
      posthog.register({ product: PRODUCT });
      sharedWindow()[GLOBAL_CLIENT_KEY] = posthog;
      client = posthog;
      const pending = sharedQueue();
      const batch = pending.splice(0);
      for (const item of batch) posthog.capture(item.event, item.props);
      return posthog;
    })
    .catch(() => null)
    .finally(() => {
      starting = null;
    });
  return starting;
}

export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  const run = () => void start();
  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (document.readyState === "complete") {
    if (typeof idleWindow.requestIdleCallback === "function") idleWindow.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 2000);
  } else {
    window.addEventListener("load", run, { once: true });
  }
  for (const event of ["pointerdown", "keydown", "scroll"] as const) {
    window.addEventListener(event, run, { once: true, passive: true });
  }
  installClickTracking();
  installScrollTracking();
}

export function capture(event: string, props: AnalyticsProps = {}): void {
  if (!/^[a-z0-9_$]{1,80}$/i.test(event)) return;
  const clean = sanitizeProps({ ...props, product: PRODUCT });
  const active = sharedClient();
  if (active) {
    active.capture(event, clean);
    return;
  }
  const pending = sharedQueue();
  if (pending.length < MAX_QUEUE) pending.push({ event, props: clean });
}

export function trackPageview(path = page()): void {
  const clean = safePath(path);
  const now = Date.now();
  if (lastPageview.path === clean && now - lastPageview.at < 1500) return;
  lastPageview = { path: clean, at: now };
  scrollMarks = new Set();
  capture("$pageview", {
    $current_url: `${window.location.origin}${clean}`,
    $pathname: clean,
    page: clean,
  });
}

function ctaFromHref(href: string): string | null {
  if (href.startsWith("/sign-up")) return "signup";
  if (href.startsWith("/pricing")) return "pricing";
  if (href.startsWith("/?place=")) return "personalize_report";
  if (href.startsWith("/map")) return "district_map";
  return null;
}

function installClickTracking(): void {
  if (typeof document === "undefined" || document.documentElement.dataset.ithAnalyticsClick === "1") return;
  document.documentElement.dataset.ithAnalyticsClick = "1";
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-cta], a[href]") : null;
      if (!target) return;
      const cta = target.dataset.cta || (target instanceof HTMLAnchorElement ? ctaFromHref(target.getAttribute("href") || "") : null);
      if (cta) {
        capture("cta_click", {
          cta,
          surface: target.dataset.surface || "unknown",
          page: page(),
        });
      }
      if (target instanceof HTMLAnchorElement) {
        const href = target.getAttribute("href") || "";
        try {
          const url = new URL(href, window.location.origin);
          if (url.origin !== window.location.origin && (url.protocol === "http:" || url.protocol === "https:")) {
            capture("outbound_click", {
              href_host: url.hostname.slice(0, 120),
              href_path: url.pathname.slice(0, 200),
              page: page(),
            });
          }
        } catch {
          // ignore malformed hrefs
        }
      }
    },
    { capture: false },
  );
}

function installScrollTracking(): void {
  if (typeof window === "undefined" || document.documentElement.dataset.ithAnalyticsScroll === "1") return;
  document.documentElement.dataset.ithAnalyticsScroll = "1";
  const check = () => {
    scrollQueued = false;
    const doc = document.documentElement;
    const height = doc.scrollHeight - window.innerHeight;
    if (height <= 0) return;
    const percent = Math.min(100, Math.round((window.scrollY / height) * 100));
    for (const mark of [25, 50, 75, 100]) {
      if (percent >= mark && !scrollMarks.has(mark)) {
        scrollMarks.add(mark);
        capture("scroll_depth", { percent: mark, page: page() });
      }
    }
  };
  window.addEventListener(
    "scroll",
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(check);
    },
    { passive: true },
  );
}
