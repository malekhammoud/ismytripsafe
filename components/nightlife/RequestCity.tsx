"use client"

import { useMemo, useState, type FormEvent } from "react"
import { capture } from "@/lib/analytics"
import Link from "next/link"
import { ArrowUpRight, Check, Loader2, MapPin } from "lucide-react"
import type { DirectoryCity } from "./Directory"

/**
 * "Please map my city."
 *
 * The index already lists every city with a safety report. This form turns
 * the ones without a nightlife guide into a durable request that the nightly
 * research batch picks up before routine refreshes. It is honest about the
 * contract: a request is not a promise to publish, because a city with two
 * bars should get no guide rather than a thin one.
 *
 * The suggestions use a native <datalist>: keyboard support, mobile pickers
 * and screen-reader behaviour come free, and the ~1,300 options are only
 * materialised once the field is focused, so the first paint doesn't pay for
 * them.
 */

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string; href?: string; hrefLabel?: string }
  | { kind: "error"; message: string }

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()

interface Option {
  path: string
  city: string
  country: string
  label: string
  published: boolean
}

export function RequestCity({ cities }: { cities: DirectoryCity[] }) {
  const options = useMemo<Option[]>(
    () =>
      cities.map((city) => ({
        path: city.path.replace(/\/nightlife$/, ""),
        city: city.city,
        country: city.country,
        label: `${city.city}, ${city.country}`,
        published: !!city.report,
      })),
    [cities],
  )
  const openCount = options.filter((option) => !option.published).length

  const [query, setQuery] = useState("")
  const [showOptions, setShowOptions] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [honeypot, setHoneypot] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status.kind === "pending") return

    const q = normalize(query)
    if (!q) {
      setStatus({ kind: "error", message: "Type a city, or pick one from the suggestions." })
      return
    }
    const exact =
      options.find((option) => normalize(option.label) === q) ??
      options.find((option) => normalize(`${option.city} ${option.country}`) === q)
    const byCity = options.filter((option) => normalize(option.city) === q)
    const match = exact ?? (byCity.length === 1 ? byCity[0] : null)

    if (!match) {
      setStatus({
        kind: "error",
        message: byCity.length > 1
          ? "There is more than one city with that name. Pick the country too."
          : "Pick a city from the suggestions so we know which one you mean.",
      })
      return
    }
    if (match.published) {
      setStatus({
        kind: "ok",
        message: `We already have a nightlife guide for ${match.label}.`,
        href: `${match.path}/nightlife`,
        hrefLabel: "Open the guide",
      })
      return
    }

    capture("nightlife_city_requested", { page: window.location.pathname })
    setStatus({ kind: "pending" })
    try {
      const response = await fetch("/api/nightlife/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: match.path, company: honeypot }),
      })
      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean
            status?: string
            research?: string
            message?: string
            city?: string
            country?: string
            href?: string
          }
        | null

      if (data?.status === "published" && data.href) {
        setStatus({
          kind: "ok",
          message: `We already have a nightlife guide for ${data.city ?? match.city}.`,
          href: data.href,
          hrefLabel: "Open the guide",
        })
        return
      }
      if (data?.ok) {
        const running = data.research === "running"
        setStatus({
          kind: "ok",
          message: running
            ? `Research has started for ${match.label}. The first guide usually takes under a minute.`
            : data.status === "already-queued"
              ? `${match.label} is already in the queue — your request moves it up.`
              : `Request received. ${match.label} is in the research queue; guides are built in nightly batches.`,
          href: data.href,
          hrefLabel: "Follow progress",
        })
        setQuery("")
        return
      }
      setStatus({
        kind: "error",
        message: data?.message || "That didn't send. Try again in a moment.",
      })
    } catch {
      setStatus({ kind: "error", message: "That didn't send. Check your connection and try again." })
    }
  }

  return (
    <section id="nlg-request" className="nlg-request" aria-labelledby="nlg-request-title">
      <div className="nlg-request-copy">
        <p className="postcard-greeting">Ask for a city</p>
        <h3 id="nlg-request-title">No guide for your city yet?</h3>
        <p>
          Tell us where you&apos;re going. Requests jump ahead of our nightly research queue — we
          publish only when there are enough real venues to describe, so a request is not a promise
          to publish.
        </p>
        {openCount > 0 && (
          <p className="nlg-request-count">
            <MapPin size={13} aria-hidden /> {openCount.toLocaleString("en")} cities have a safety
            report and no nightlife guide yet.
          </p>
        )}
      </div>

      <form className="nlg-request-form" onSubmit={submit} noValidate>
        <label htmlFor="nlg-request-city">City</label>
        <div className="nlg-request-row">
          <input
            id="nlg-request-city"
            type="text"
            list="nlg-request-options"
            value={query}
            placeholder="e.g. Dresden, Germany"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="nlg-request-help"
            onFocus={() => setShowOptions(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setShowOptions(true)
              if (status.kind !== "idle") setStatus({ kind: "idle" })
            }}
          />
          <button type="submit" disabled={status.kind === "pending"} aria-busy={status.kind === "pending"}>
            {status.kind === "pending" ? <Loader2 size={15} className="nlg-request-spin" aria-hidden /> : null}
            {status.kind === "pending" ? "Sending…" : "Request a guide"}
          </button>
        </div>
        {showOptions && (
          <datalist id="nlg-request-options">
            {options.map((option) => (
              <option key={option.path} value={option.label}>
                {option.published ? "Guide already published" : "Send a request"}
              </option>
            ))}
          </datalist>
        )}
        {/* Bots fill this; people never see it. */}
        <input
          className="nlg-request-hp"
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
        <p id="nlg-request-help" className="nlg-request-help">
          Start typing for suggestions. Every request is read by a person.
        </p>
        <div role="status" aria-live="polite">
          {status.kind === "ok" && (
            <p className="nlg-request-status is-ok">
              <Check size={14} aria-hidden /> {status.message}
              {status.href && (
                <Link href={status.href} prefetch={false}>
                  {status.hrefLabel ?? "Follow progress"} <ArrowUpRight size={12} aria-hidden />
                </Link>
              )}
            </p>
          )}
          {status.kind === "error" && <p className="nlg-request-status is-error">{status.message}</p>}
        </div>
      </form>
    </section>
  )
}
