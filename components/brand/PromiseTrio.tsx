import Image from "next/image"
import { MapPin, MousePointerClick, FileText } from "lucide-react"
import onePlace from "@/public/brand/panel-one-place.jpg"
import oneClick from "@/public/brand/panel-one-click.jpg"
import oneReport from "@/public/brand/panel-one-report.jpg"

// The banner's three panels, rebuilt as a responsive section: the artwork is
// cropped below its baked-in captions so the headings here are real text.
const PANELS = [
  {
    img: onePlace,
    icon: <MapPin size={15} strokeWidth={2.4} />,
    title: "One Place",
    body: "A city, a town, a whole country. Type where you're going — no account, no forms, no paywall.",
    alt: "A traveller cycling along a Mediterranean beachfront promenade",
  },
  {
    img: oneClick,
    icon: <MousePointerClick size={15} strokeWidth={2.4} />,
    title: "One Click",
    body: "Tell us who's actually travelling — solo or family, age, trip style — and the score re-weights around that party.",
    alt: "A traveller checking her phone on a cobbled street beside a yellow tram",
  },
  {
    img: oneReport,
    icon: <FileText size={15} strokeWidth={2.4} />,
    title: "One Report",
    body: "One rating out of 100, the five scores behind it, a neighbourhood map and a written briefing. Free, every time.",
    alt: "A phone showing an IsMyTripSafe safety report for Tokyo",
  },
]

export function PromiseTrio() {
  return (
    <section className="mt-16 w-full rise-in" style={{ animationDelay: "0.34s" }}>
      <div className="grid gap-6 sm:grid-cols-3 sm:gap-5">
        {PANELS.map((p) => (
          <figure key={p.title} className="flex flex-col">
            <div className="photo-frame relative aspect-[16/10] w-full sm:aspect-square">
              <Image
                src={p.img}
                alt={p.alt}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                placeholder="blur"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-4">
              <span className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: "rgba(243,108,10,0.12)", color: "var(--orange-deep)" }}
                  aria-hidden
                >
                  {p.icon}
                </span>
                <span className="swash text-[1.15rem]">{p.title}</span>
              </span>
              <p className="mt-3.5 text-[0.85rem] leading-relaxed text-[var(--ink-soft)]">{p.body}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
