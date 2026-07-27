import Image from "next/image"
import banner from "@/public/brand/banner.jpg"

/** River's banner, whole — one piece of art, shown at full width. */
export function BrandBanner({
  priority = false,
  className = "",
}: {
  priority?: boolean
  className?: string
}) {
  return (
    <div className={`photo-frame ${className}`}>
      <Image
        src={banner}
        alt="IsMyTripSafe — one place, one click, one report"
        placeholder="blur"
        sizes="(max-width: 1024px) 100vw, 1024px"
        priority={priority}
      />
    </div>
  )
}
