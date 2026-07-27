import Image from "next/image"
import wash from "@/public/brand/badge-wash.png"

/**
 * The illustrated badge as scenery: feathered at the edges and dropped to a
 * whisper behind the hero, so it colours the page without competing with the
 * one thing anyone came here to do. Decorative — hidden from assistive tech,
 * and from narrow screens, where there's no room beside the text.
 */
export function BadgeWash() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -z-10 hidden select-none sm:block"
      style={{ top: "-7rem", right: "-14rem", width: "38rem", opacity: 0.1 }}
    >
      <Image src={wash} alt="" sizes="544px" priority />
    </div>
  )
}
