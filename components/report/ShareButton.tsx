"use client"

import { useEffect, useRef, useState } from "react"
import { Share2, Copy, ImageDown, Link2, Check, Loader2, X } from "lucide-react"
import { toBlob } from "html-to-image"

type ItemKey = "native" | "copyImage" | "copyLink" | "download"
type ItemState = "idle" | "busy" | "done" | "error"

/**
 * Share the report as the platform's own image: the hero card (score ring,
 * photo, verdict) captured pixel-for-pixel from the DOM. Native share sends
 * message + report link + image together (iOS share sheet); elsewhere the
 * image can be copied to the clipboard or downloaded. The button and menu
 * carry data-noshare so they never appear in the captured image.
 */
export function ShareButton({
  targetId,
  city,
  score,
  answer,
}: {
  targetId: string
  city: string
  score: number
  answer: string
}) {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [canNative, setCanNative] = useState(false)
  const [states, setStates] = useState<Partial<Record<ItemKey, ItemState>>>({})
  const blobRef = useRef<Blob | null>(null)
  const genRef = useRef<Promise<Blob | null> | null>(null)

  useEffect(() => {
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const fileName = `ismytripsafe-${slug || "report"}.png`
  const shareText = `Is ${city} safe? ${answer} — ${score}/100 on IsMyTripSafe.`
  const shareUrl = () => window.location.href

  // Render the hero to a PNG blob once per open; kicked off when the menu
  // opens so the blob is usually ready before an option is tapped (Safari's
  // share/clipboard calls need to stay close to the user gesture).
  const generate = (): Promise<Blob | null> => {
    if (!genRef.current) {
      const node = document.getElementById(targetId)
      genRef.current = node
        ? toBlob(node, {
            pixelRatio: 2,
            filter: (n: HTMLElement) => !(n instanceof HTMLElement && n.dataset?.noshare != null),
          })
            .then((b) => {
              blobRef.current = b
              setReady(!!b)
              return b
            })
            .catch(() => {
              genRef.current = null
              return null
            })
        : Promise.resolve(null)
    }
    return genRef.current
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      setStates({})
      generate()
    }
  }

  const flash = (key: ItemKey, state: ItemState, closeAfter = false) => {
    setStates((s) => ({ ...s, [key]: state }))
    if (state === "done" || state === "error") {
      setTimeout(() => {
        setStates((s) => ({ ...s, [key]: "idle" }))
        if (closeAfter && state === "done") setOpen(false)
      }, 1400)
    }
  }

  const doNative = async () => {
    flash("native", "busy")
    try {
      const blob = blobRef.current ?? (await generate())
      const data: ShareData = {
        title: `Is ${city} safe?`,
        text: shareText,
        url: shareUrl(),
      }
      if (blob) {
        const file = new File([blob], fileName, { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) data.files = [file]
      }
      await navigator.share(data)
      flash("native", "done", true)
    } catch (err) {
      // AbortError = user dismissed the sheet; not a failure worth flagging.
      if ((err as Error)?.name === "AbortError") flash("native", "idle")
      else flash("native", "error")
    }
  }

  const doCopyImage = async () => {
    flash("copyImage", "busy")
    try {
      // Promise-valued ClipboardItem keeps the write inside the user gesture
      // even while the PNG is still rendering (required by Safari).
      const png = generate().then((b) => {
        if (!b) throw new Error("capture failed")
        return b
      })
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })])
      flash("copyImage", "done", true)
    } catch {
      try {
        const b = await generate()
        if (!b) throw new Error("capture failed")
        await navigator.clipboard.write([new ClipboardItem({ "image/png": b })])
        flash("copyImage", "done", true)
      } catch {
        flash("copyImage", "error")
      }
    }
  }

  const doCopyLink = async () => {
    flash("copyLink", "busy")
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl()}`)
      flash("copyLink", "done", true)
    } catch {
      flash("copyLink", "error")
    }
  }

  const doDownload = async () => {
    flash("download", "busy")
    const blob = blobRef.current ?? (await generate())
    if (!blob) return flash("download", "error")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    flash("download", "done", true)
  }

  const stateIcon = (key: ItemKey, idle: React.ReactNode) => {
    const s = states[key] ?? "idle"
    if (s === "busy") return <Loader2 size={14} className="spin" />
    if (s === "done") return <Check size={14} style={{ color: "var(--safe)" }} />
    if (s === "error") return <X size={14} style={{ color: "var(--risky)" }} />
    return idle
  }

  const item =
    "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-[0.82rem] font-medium transition-colors hover:bg-[var(--paper)] disabled:opacity-50"

  return (
    <span className="relative inline-flex" data-noshare>
      <button
        type="button"
        onClick={toggle}
        aria-label="Share this report"
        aria-expanded={open}
        className="chip flex items-center gap-1.5 px-2.5 py-1 text-[0.7rem] font-semibold transition-transform hover:scale-105"
      >
        <Share2 size={12} strokeWidth={2.4} />
        Share
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <span className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <span
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[230px] rounded-[12px] p-1.5"
            style={{ background: "#fff", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-float)", color: "var(--ink)" }}
            role="menu"
          >
            <span className="block px-3 pb-1 pt-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ink-faint)" }}>
              {ready ? "Share this report" : "Preparing image…"}
            </span>
            {canNative && (
              <button type="button" role="menuitem" className={item} onClick={doNative}>
                {stateIcon("native", <Share2 size={14} style={{ color: "var(--accent)" }} />)}
                Share… <span className="ml-auto text-[0.62rem] font-normal" style={{ color: "var(--ink-faint)" }}>image + link</span>
              </button>
            )}
            <button type="button" role="menuitem" className={item} onClick={doCopyImage} disabled={!ready}>
              {stateIcon("copyImage", <Copy size={14} style={{ color: "var(--accent)" }} />)}
              {states.copyImage === "done" ? "Image copied" : "Copy image"}
            </button>
            <button type="button" role="menuitem" className={item} onClick={doCopyLink}>
              {stateIcon("copyLink", <Link2 size={14} style={{ color: "var(--accent)" }} />)}
              {states.copyLink === "done" ? "Link copied" : "Copy message + link"}
            </button>
            <button type="button" role="menuitem" className={item} onClick={doDownload} disabled={!ready}>
              {stateIcon("download", <ImageDown size={14} style={{ color: "var(--accent)" }} />)}
              Download image
            </button>
          </span>
        </>
      )}
    </span>
  )
}
