"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageview } from "@/lib/analytics";

/** Records one sanitized pageview per client-side navigation. */
export function AnalyticsPageview() {
  const pathname = usePathname();
  useEffect(() => {
    trackPageview(pathname || "/");
  }, [pathname]);
  return null;
}
