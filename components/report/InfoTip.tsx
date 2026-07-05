"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import type { ReactNode, RefObject, MouseEvent as ReactMouseEvent } from "react"
import { createPortal } from "react-dom"
import { Info } from "lucide-react"

/**
 * A small "i" bubble that explains a term. The tooltip is rendered in a portal
 * with fixed, viewport-clamped positioning so it is never clipped by an
 * `overflow:hidden` ancestor and never overflows the screen edge. It opens on
 * hovering the icon (desktop) or tapping it (touch) — not on hovering the
 * surrounding section.
 */
export function InfoTip({
  text,
  label = "What this means",
  color = "#141922",
  children,
}: {
  text: string
  label?: string
  color?: string
  /** deprecated — positioning is now automatic/viewport-clamped */
  align?: "left" | "center" | "right"
  /** custom hover trigger (e.g. a colour pill) instead of the default "i" icon */
  children?: ReactNode
}) {
  const [visible, setVisible] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState({ top: -9999, left: -9999 })
  const [ready, setReady] = useState(false)
  const [mounted, setMounted] = useState(false)

  const btnRef = useRef<HTMLElement | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])

  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (btnRef.current) rectRef.current = btnRef.current.getBoundingClientRect()
    setVisible(true)
  }
  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!pinned) {
        setVisible(false)
        setReady(false)
      }
    }, 120)
  }

  // Position the tooltip once it (and its size) exist, clamped to the viewport.
  useLayoutEffect(() => {
    if (!visible) return
    const r = rectRef.current
    const tip = tipRef.current
    if (!r || !tip) return
    const m = 8
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    let left = r.left + r.width / 2 - w / 2
    left = Math.max(m, Math.min(left, window.innerWidth - w - m))
    let top = r.bottom + 6
    if (top + h > window.innerHeight - m) top = Math.max(m, r.top - h - 6)
    setPos({ top, left })
    setReady(true)
  }, [visible, text])

  // Dismiss a pinned tip on outside click or scroll.
  useEffect(() => {
    if (!pinned) return
    const onDown = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        tipRef.current && !tipRef.current.contains(e.target as Node)
      ) {
        setPinned(false)
        setVisible(false)
        setReady(false)
      }
    }
    const onScroll = () => {
      setPinned(false)
      setVisible(false)
      setReady(false)
    }
    document.addEventListener("mousedown", onDown)
    window.addEventListener("scroll", onScroll, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      window.removeEventListener("scroll", onScroll, true)
    }
  }, [pinned])

  const onClick = (e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (pinned) {
      setPinned(false)
      setVisible(false)
      setReady(false)
    } else {
      setPinned(true)
      show()
    }
  }

  return (
    <>
      {children ? (
        <span
          ref={btnRef as RefObject<HTMLSpanElement>}
          role="button"
          tabIndex={0}
          aria-label={label}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          onClick={onClick}
          className="cursor-help"
        >
          {children}
        </span>
      ) : (
        <button
          ref={btnRef as RefObject<HTMLButtonElement>}
          type="button"
          aria-label={label}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          onClick={onClick}
          className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full align-middle opacity-55 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
          style={{ color }}
        >
          <Info size={12} strokeWidth={2.4} />
        </button>
      )}

      {mounted &&
        visible &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: 240,
              zIndex: 9999,
              background: "#ffffff",
              color: "var(--ink-soft)",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              padding: "9px 11px",
              fontSize: "0.74rem",
              lineHeight: 1.5,
              boxShadow: "var(--shadow-float)",
              opacity: ready ? 1 : 0,
              transition: "opacity 120ms ease",
              pointerEvents: "auto",
            }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  )
}
