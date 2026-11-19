import type { NextConfig } from "next";

/**
 * Art and geography are content, not routes: they change when we redeploy a
 * new file, not between requests. Next serves `public/` with
 * `Cache-Control: public, max-age=0`, which makes every visit revalidate a
 * hero image that has not changed since the last one. A week in the browser
 * cache (with a stale-while-revalidate window) removes that round trip.
 *
 * Filenames are stable, so a replacement can lag by up to a week for a
 * returning visitor. Bump the name when the pixels change.
 */
const ART_CACHE = [
  { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/photos/:path*", headers: ART_CACHE },
      { source: "/geo/:path*", headers: ART_CACHE },
      { source: "/brand/:path*", headers: ART_CACHE },
    ];
  },
};

export default nextConfig;
