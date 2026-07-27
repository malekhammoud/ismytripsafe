"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { RotateCw, House } from "lucide-react"
import { Logo } from "@/components/Logo"

// A deploy replaces the built chunks, so a tab that was open across one asks
// for files that no longer exist and throws where nothing catches it — which is
// how a working site shows "this page couldn't load". That case is recoverable
// by fetching the new build, so we do it for the reader, once, rather than
// making them think to reload.
const STALE = /chunk|dynamically imported module|module script failed|importing a module/i
const RELOADED_KEY = "imts:reloaded-after-stale-build"

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    console.error(error)
    if (!STALE.test(error.message || "")) return
    // Once per session: if the fresh build throws too, it isn't staleness and
    // reloading again would just spin.
    try {
      if (sessionStorage.getItem(RELOADED_KEY)) return
      sessionStorage.setItem(RELOADED_KEY, "1")
    } catch {
      return // private mode, no storage — don't risk a loop
    }
    setReloading(true)
    window.location.reload()
  }, [error])

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 py-16">
      <div className="card w-full max-w-[30rem] p-7">
        <span className="wordmark flex items-center gap-1.5 text-[0.9rem] text-[var(--navy)]">
          <Logo size={16} />
          <span>
            IsMyTripSafe<span style={{ color: "var(--orange)" }}>.com</span>
          </span>
        </span>

        <h1 className="font-display mt-5 text-[1.5rem] font-medium tracking-tight text-[var(--navy)]">
          {reloading ? "Getting the latest version…" : "That didn't load"}
        </h1>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-[var(--ink-soft)]">
          {reloading
            ? "The site was updated while this page was open. One moment."
            : "Something went wrong on our end — not on yours, and nothing to do with the place you were checking. Try again, and if it keeps happening we'd like to know."}
        </p>

        {!reloading && (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => unstable_retry()}
                className="btn inline-flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                <RotateCw size={15} />
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-[var(--accent-deep)] hover:underline"
              >
                <House size={14} />
                Start a new check
              </Link>
            </div>

            <p className="mt-6 border-t border-[var(--hairline)] pt-4 text-[0.75rem] text-[var(--ink-faint)]">
              Still stuck?{" "}
              <a
                href={`mailto:malek@malekhammoud.com?subject=${encodeURIComponent(
                  `Error on IsMyTripSafe${error.digest ? ` (${error.digest})` : ""}`,
                )}`}
                className="font-medium text-[var(--accent-deep)] hover:underline"
              >
                Tell us what you were doing
              </a>
              {error.digest && (
                <>
                  {" · reference "}
                  <span className="tnum">{error.digest}</span>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </main>
  )
}
