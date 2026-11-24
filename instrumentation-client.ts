// PostHog, loaded after the page is useful.
//
// `posthog-js` is ~60 KB gzipped and, with session recording and heatmaps on,
// it wants the main thread at exactly the moment the hero image, the fonts
// and hydration do. None of that is worth a pageview that arrives two seconds
// later, so the import waits for `load` plus an idle slot — or for the first
// interaction, whichever comes first. `init` then replays the current
// pageview, so nothing is lost from the funnel.
//
// The key and host are inlined at build time; this file only ever runs in the
// browser.

import { installClientReporter } from "./lib/ops/client";

installClientReporter();

const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  "phc_BL8wa5sXcYHPTNHbDsxfXiQHTZSgxBZ9UCrSZfPyM7cB"
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

let started = false

function start() {
  if (started) return
  started = true
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      defaults: "2026-06-25",
      person_profiles: "always",
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_exceptions: true,
      capture_heatmaps: true,
      capture_dead_clicks: true,
      capture_performance: true,
      enable_recording_console_log: true,
    })
  })
}

function arm() {
  if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 3000 })
  else setTimeout(start, 2000)
}

if (document.readyState === "complete") arm()
else window.addEventListener("load", arm, { once: true })

// A visitor who starts using the site straight away is a visitor worth
// measuring straight away.
for (const event of ["pointerdown", "keydown", "scroll"] as const) {
  window.addEventListener(event, start, { once: true, passive: true })
}
