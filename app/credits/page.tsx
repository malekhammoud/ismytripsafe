import type { Metadata } from "next"
import Link from "next/link"
import { PHOTO_POOL } from "@/lib/photos"
import { Breadcrumbs, SectionHeading, SeoFooter, SiteHeader } from "@/components/seo/shared"

export const metadata: Metadata = {
  title: "Photo Credits",
  description:
    "Every photograph used on IsMyTripSafe, with its photographer, licence and source.",
  alternates: { canonical: "/credits" },
}

const trail = [
  { name: "Home", href: "/" },
  { name: "Photo credits", href: "/credits" },
]

export default function CreditsPage() {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <div className="mx-auto max-w-[760px]">
          <Breadcrumbs trail={trail} />
          <p className="postcard-greeting">With thanks to</p>
          <h1 className="font-display mt-1 text-[clamp(1.7rem,5vw,2.3rem)] font-medium leading-tight tracking-tight text-[var(--navy)]">
            Photo credits
          </h1>
          <p className="mt-3.5 text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
            Every image on this site is a real photograph — nothing here is an illustration or
            generated. Photos of a specific destination come from that place&apos;s Wikipedia,
            Wikivoyage or Wikimedia Commons entry and are credited on the report itself. The
            photographs below are the house set, used where a destination has no picture of its own
            and for the page furniture, and they are listed here because their licences ask for it.
          </p>

          <section className="mt-9">
            <SectionHeading note={`${PHOTO_POOL.length} photographs`}>The house set</SectionHeading>
            <ul className="mt-4 space-y-3">
              {PHOTO_POOL.map((p) => (
                <li key={p.slug} className="card flex items-center gap-4 overflow-hidden p-3">
                  <span className="photo-frame block h-16 w-24 shrink-0 sm:h-[4.5rem] sm:w-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.file} alt="" loading="lazy" decoding="async" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <a
                      href={p.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-[0.88rem] font-semibold text-[var(--navy)] hover:text-[var(--accent-deep)] hover:underline"
                      title={p.title}
                    >
                      {p.title.replace(/\.(jpg|jpeg|png)$/i, "")}
                    </a>
                    <span className="mt-0.5 block text-[0.78rem] text-[var(--ink-soft)]">
                      {p.author || "Unknown photographer"}
                    </span>
                    <span className="mt-0.5 block text-[0.74rem] text-[var(--ink-faint)]">
                      {p.licenseUrl ? (
                        <a
                          href={p.licenseUrl}
                          target="_blank"
                          rel="noopener noreferrer license"
                          className="hover:text-[var(--accent-deep)] hover:underline"
                        >
                          {p.license}
                        </a>
                      ) : (
                        p.license
                      )}
                      {" · via Wikimedia Commons"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-8 text-[0.82rem] leading-relaxed text-[var(--ink-faint)]">
            Photographs are reproduced under their own licences and remain the copyright of their
            photographers; the licence link beside each one sets out what that permits. Some have
            been resized for the web, and nothing else has been changed. If you are a photographer
            here and would like a credit corrected or a photo removed,{" "}
            <a
              href="mailto:malek@ismytripsafe.com"
              className="font-medium text-[var(--accent-deep)] hover:underline"
            >
              email us
            </a>{" "}
            and we will do it.
          </p>

          <p className="mt-6 text-[0.85rem] text-[var(--ink-soft)]">
            <Link href="/destinations" className="font-semibold text-[var(--accent-deep)] hover:underline">
              Back to the globe →
            </Link>
          </p>

          <SeoFooter />
        </div>
      </main>
    </>
  )
}
