import Image from "next/image"
import badge from "@/public/brand/badge.png"

/**
 * The full illustrated badge, masked out of the artwork River sent. Use it
 * where there's room for it to read as a picture; the header mark is `Logo`.
 */
export function BrandBadge({
  size = 96,
  className = "",
  priority = false,
}: {
  size?: number
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={badge}
      alt="IsMyTripSafe"
      width={size}
      height={size}
      priority={priority}
      sizes={`${size}px`}
      className={`select-none ${className}`}
      style={{
        width: size,
        height: size,
        filter: "drop-shadow(0 10px 22px rgba(11,32,73,0.28))",
      }}
    />
  )
}
