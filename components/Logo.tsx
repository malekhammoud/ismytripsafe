import { useId } from "react"

/**
 * The IsMyTripSafe mark, lifted from the badge River designed: an orange
 * location pin holding a navy check. Drawn rather than cropped so it stays
 * crisp at 14px in a header — the full illustrated badge is `BrandBadge`.
 */
export function Logo({ size = 20, className }: { size?: number; className?: string }) {
  const id = useId()
  const gradientId = `logo-g-${id}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="14" y1="4" x2="50" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fb9224" />
          <stop offset="1" stopColor="#ef5f00" />
        </linearGradient>
      </defs>
      <path
        d="M32 3C19.85 3 10 12.85 10 25c0 15.5 18.6 33.2 20.5 35.1a2.1 2.1 0 0 0 3 0C35.4 58.2 54 40.5 54 25 54 12.85 44.15 3 32 3Z"
        fill={`url(#${gradientId})`}
      />
      <circle cx="32" cy="24.5" r="12.6" fill="#ffffff" />
      <path
        d="M25.7 24.6 30.3 29.4 39 19.9"
        fill="none"
        stroke="#0b2049"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
