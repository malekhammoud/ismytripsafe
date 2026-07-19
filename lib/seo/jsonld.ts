import { SITE_NAME, SITE_URL, absUrl } from "../site"
import type { ReportMeta } from "../reports"
import type { Crumb } from "@/components/seo/shared"

// ─────────────────────────────────────────────────────────────────────
// JSON-LD builders. One @graph per page with @id cross-references.
// Deliberately omitted (retired or ignored by Google as of 2026):
// FAQPage, HowTo, WebSite.potentialAction/SearchAction, standalone Place.
// ─────────────────────────────────────────────────────────────────────

export const ORG_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`

export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description:
      "Independent travel-safety reports combining official government advisories with crime, governance, health and hazard data from 15+ public databases.",
  }
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    publisher: { "@id": ORG_ID },
  }
}

export function breadcrumbNode(trail: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absUrl(c.href),
    })),
  }
}

export function reportArticleNode(opts: {
  meta: ReportMeta
  headline: string
  description: string
  image?: string | null
}) {
  const { meta, headline, description, image } = opts
  return {
    "@type": "Article",
    "@id": `${absUrl(meta.path)}#report`,
    headline,
    description,
    url: absUrl(meta.path),
    datePublished: meta.createdAt,
    dateModified: meta.updatedAt,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    ...(image ? { image: [image] } : {}),
    about: {
      "@type": "Place",
      name: `${meta.city}, ${meta.country}`,
      geo: { "@type": "GeoCoordinates", latitude: meta.lat, longitude: meta.lon },
      address: { "@type": "PostalAddress", addressCountry: meta.countryCode },
    },
  }
}

/** Dataset node — the per-city safety metrics, with a real JSON download. */
export function reportDatasetNode(meta: ReportMeta) {
  return {
    "@type": "Dataset",
    "@id": `${absUrl(meta.path)}#dataset`,
    name: `${meta.city} travel safety indicators`,
    description:
      `Composite travel-safety score (${meta.score}/100) and underlying indicators for ` +
      `${meta.city}, ${meta.country}: government advisory levels, homicide and victimisation ` +
      `rates, governance percentiles, air quality, natural-hazard alerts and health notices, ` +
      `aggregated from public sources including the U.S. State Department, UK FCDO, Government ` +
      `of Canada, World Bank, UNODC, WHO, CDC, GDACS and USGS.`,
    url: absUrl(meta.path),
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    creator: { "@id": ORG_ID },
    dateModified: meta.updatedAt,
    spatialCoverage: {
      "@type": "Place",
      name: `${meta.city}, ${meta.country}`,
      geo: { "@type": "GeoCoordinates", latitude: meta.lat, longitude: meta.lon },
    },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: absUrl(`${meta.path}/data.json`),
      },
    ],
  }
}

/** Serialize a @graph for a <script type="application/ld+json"> tag. */
export function graph(...nodes: object[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes })
}
