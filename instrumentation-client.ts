import posthog from "posthog-js"

const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  "phc_BL8wa5sXcYHPTNHbDsxfXiQHTZSgxBZ9UCrSZfPyM7cB"
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

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
