// Browser bootstrap: error reporting plus privacy-safe, deferred analytics.
//
// Analytics is deliberately lazy. The page must be useful before PostHog is
// downloaded, and no profile, trip, or free-text data may leave the browser.

import { installClientReporter } from "./lib/ops/client";
import { initAnalytics } from "./lib/analytics";

installClientReporter();
initAnalytics();
