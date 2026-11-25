import "./planmytrip-rail.css"

/**
 * Side-rail cross-sell for PlanMyTrip.health.
 *
 * Inputs: the report's city/country and the report kind.
 * Outputs: a fixed right-rail advertisement, visible only where the report
 *          layout has unused side space, linked to the matching PlanMyTrip signup.
 * Invariants: hidden on narrow screens; no health profile, query string, or personal
 * data is sent in the URL beyond the destination the reader is already viewing.
 */

export interface PlanMyTripRailProps {
  city: string
  country?: string
  context?: "city" | "country" | "nightlife"
  placement: string
}

function railHref(city: string, country: string | undefined, placement: string, home = false): string {
  const destination = country && country !== city ? `${city}, ${country}` : city
  const params = new URLSearchParams({
    utm_source: "ismytripsafe",
    utm_medium: "side_rail",
    utm_campaign: "planmytrip_crosssell",
    utm_content: placement,
  })
  if (home) return `https://planmytrip.health/?${params.toString()}`
  params.set("redirect_url", `/?destination=${encodeURIComponent(destination)}`)
  return `https://planmytrip.health/sign-up?${params.toString()}`
}

function displayCity(city: string): string {
  const clean = city.trim() || "your trip"
  return clean.length > 26 ? `${clean.slice(0, 24).trimEnd()}…` : clean
}

export function PlanMyTripRail({
  city,
  country,
  context = "city",
  placement,
}: PlanMyTripRailProps) {
  const place = displayCity(city)
  const shortPlace = city.trim().length <= 12
  const headline =
    context === "nightlife"
      ? "You checked the night. Now plan the day."
      : context === "country"
        ? "You checked the country. Now pace the trip."
        : "You checked the risk. Now pace the trip."
  const cta = shortPlace ? `Plan my ${place} trip` : "Plan my trip"

  return (
    <aside
      className={`pmt-rail ${context === "nightlife" ? "pmt-rail--night" : ""}`}
      aria-label="Advertisement for PlanMyTrip.health, a health-aware trip planner"
    >
      <p className="pmt-rail-kicker">Advertisement · PlanMyTrip.health</p>
      <p className="pmt-rail-sister">From the team at IsMyTripSafe</p>
      <p className="pmt-rail-city">{place}</p>
      <p className="pmt-rail-headline">{headline}</p>
      <p className="pmt-rail-copy">
        A day-by-day plan with walking ceilings, scheduled recovery, and a safety envelope,
        built around your health.
      </p>
      <ul className="pmt-rail-list">
        <li>Daily step and walking ceilings</li>
        <li>Recovery built into the day</li>
        <li>A real route and live-checked places</li>
      </ul>
      <a
        className="pmt-rail-cta"
        href={railHref(city, country, placement)}
        data-cta="planmytrip"
        data-surface={placement}
      >
        {cta}
      </a>
      <a
        className="pmt-rail-learn"
        href={railHref(city, country, placement, true)}
        data-cta="planmytrip_learn"
        data-surface={placement}
      >
        See how it works →
      </a>
      <p className="pmt-rail-fine">Planning aid only. Not medical advice.</p>
    </aside>
  )
}
