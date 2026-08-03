import Link from "next/link"
import { FlaskConical } from "lucide-react"

export const IS_BETA = process.env.NEXT_PUBLIC_IS_BETA === "1"

/**
 * The strip that keeps beta honest: nobody should mistake this origin for
 * the live site, and anyone who lands on it by accident gets a way back.
 * Renders nothing at all when the flag is off, so the same tree can be
 * merged to main without carrying staging chrome into production.
 */
export function BetaRibbon() {
  if (!IS_BETA) return null
  return (
    <div
      className="relative z-50 text-center text-[0.72rem] font-medium tracking-wide text-[#fff6e2]"
      style={{
        background: "linear-gradient(90deg, var(--orange-deep), var(--orange), var(--sun-deep))",
      }}
    >
      <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-1.5">
        <FlaskConical size={12} className="shrink-0" aria-hidden />
        <span>
          <b className="font-bold">Beta</b> — testing the globe and the postcard theme. Not indexed,
          may break.
        </span>
        <a
          href="https://ismytripsafe.com"
          className="underline underline-offset-2 hover:text-white"
        >
          Go to the live site
        </a>
        <span aria-hidden className="opacity-60">
          ·
        </span>
        <Link href="/destinations" className="underline underline-offset-2 hover:text-white">
          Try the globe
        </Link>
      </p>
    </div>
  )
}
