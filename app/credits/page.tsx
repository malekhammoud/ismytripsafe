import type { Metadata } from "next"
import Link from "next/link"
import { PHOTO_POOL, SUPPLIED_POOL, type PoolPhoto } from "@/lib/photos"
import { Breadcrumbs, SectionHeading, SeoFooter, SiteHeader } from "@/components/seo/shared"

export const metadata: Metadata = {
  title: "Photo Credits",
  description:
    "Every photograph used on IsMyTripSafe, with its photographer, licence and source — and, separately, the illustrations made for the site.",
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
            A photograph of a specific destination is always a real photograph. It comes from that
            place&apos;s Wikipedia, Wikivoyage or Wikimedia Commons entry, and it is credited on the
            report itself. Where a destination has no picture of its own, the house set below stands
            in — also real, also freely licensed, and captioned with where it actually is so a card
            never shows one place under another&apos;s name.
          </p>
          <p className="mt-3.5 text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
            The second set is different, and we would rather say so plainly than find a softer word
            for it: those images are illustrations, generated for this site. They set the mood on a
            page. They are marked as illustrations wherever they appear, and nothing we tell you
            about a destination ever rests on one.
          </p>

          <section className="mt-9">
            <SectionHeading note={`${PHOTO_POOL.length} photographs`}>The house set</SectionHeading>
            <ul className="mt-4 space-y-3">
              {PHOTO_POOL.map((p) => (
                <Credit key={p.slug} photo={p} />
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <SectionHeading note={`${SUPPLIED_POOL.length} illustrations`}>
              Made for this site
            </SectionHeading>
            <p className="mt-3 text-[0.88rem] leading-relaxed text-[var(--ink-soft)]">
              These are not photographs. They were generated for IsMyTripSafe as page furniture and
              as the postcards on the home page, and each one is captioned with the scene it depicts
              rather than a place it documents. You will see the same &ldquo;Illustration&rdquo; mark
              on them anywhere they appear on the site.
            </p>
            <ul className="mt-4 space-y-3">
              {SUPPLIED_POOL.map((p) => (
                <Credit key={p.slug} photo={p} />
              ))}
            </ul>
          </section>

          <p className="mt-8 text-[0.82rem] leading-relaxed text-[var(--ink-faint)]">
            Photographs are reproduced under their own licences and remain the copyright of their
            photographers; the licence link beside each one sets out what that permits. They have
            been resized for the web, and nothing else about them has been changed. If you are a
            photographer here and would like a credit corrected or a photo removed,{" "}
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

/**
 * One row. Branches on provenance rather than being duplicated per section:
 * a photograph gets its title linked to Commons and its licence linked to the
 * deed, while an illustration gets neither, because there is nowhere to send
 * you and no licence to honour — only a scene and the fact that it was made.
 */
function Credit({ photo: p }: { photo: PoolPhoto }) {
  const illustration = p.provenance === "illustration"
  return (
    <li className="card flex items-center gap-4 overflow-hidden p-3">
      <span className="photo-frame block h-16 w-24 shrink-0 sm:h-[4.5rem] sm:w-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.file} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="min-w-0 flex-1">
        {illustration ? (
          <span className="block truncate text-[0.88rem] font-semibold text-[var(--navy)]" title={p.title}>
            {p.place}
          </span>
        ) : (
          <a
            href={p.source}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[0.88rem] font-semibold text-[var(--navy)] hover:text-[var(--accent-deep)] hover:underline"
            title={p.title}
          >
            {p.title.replace(/\.(jpg|jpeg|png)$/i, "")}
          </a>
        )}
        <span className="mt-0.5 block text-[0.78rem] text-[var(--ink-soft)]">
          {p.author || "Unknown photographer"}
        </span>
        <span className="mt-0.5 block text-[0.74rem] text-[var(--ink-faint)]">
          {illustration ? (
            "Illustration · generated for this site, not a photograph"
          ) : (
            <>
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
            </>
          )}
        </span>
      </span>
    </li>
  )
}
