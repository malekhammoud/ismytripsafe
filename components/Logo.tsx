import { useId } from "react"

/** The IsMyTripSafe mark: a shield with a checkmark, in the brand's accent gradient. */
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
        <linearGradient id={gradientId} x1="9" y1="4" x2="55" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2b8ae6" />
          <stop offset="1" stopColor="#14538f" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 C 20 4 9 8 9 8 L 9 28 C 9 44.5 19.5 55 32 61 C 44.5 55 55 44.5 55 28 L 55 8 C 55 8 44 4 32 4 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M19.5 32.5 L28 41 L45 21.5"
        fill="none"
        stroke="#f4f7fb"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
