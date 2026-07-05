"use client"

import { create } from "zustand"
import type {
  SafetyQuery,
  SafetyBundle,
  SafetyEnrichment,
  GeoPoint,
  DestinationImages,
  StreamEvent,
} from "./types"

type Status = "idle" | "loading" | "done" | "error"

interface ReportState {
  status: Status
  query: SafetyQuery | null
  geo: GeoPoint | null
  images: DestinationImages | null
  bundle: SafetyBundle | null
  intel: SafetyEnrichment | null
  prose: string
  queries: string[]
  error: string | null
  generatedAt: string
  run: (q: SafetyQuery) => Promise<void>
  reset: () => void
}

/**
 * Central client store for the safety report. The streaming request lives here
 * (not in a component) so the report page and the map page share one fetched
 * result and the stream keeps flowing across client-side navigation.
 */
export const useReport = create<ReportState>((set, get) => ({
  status: "idle",
  query: null,
  geo: null,
  images: null,
  bundle: null,
  intel: null,
  prose: "",
  queries: [],
  error: null,
  generatedAt: "",

  reset: () =>
    set({
      status: "idle",
      query: null,
      geo: null,
      images: null,
      bundle: null,
      intel: null,
      prose: "",
      queries: [],
      error: null,
    }),

  run: async (q: SafetyQuery) => {
    // Ignore a duplicate submit for the same place while one is in flight.
    if (get().status === "loading" && get().query?.place === q.place) return

    set({
      status: "loading",
      query: q,
      geo: null,
      images: null,
      bundle: null,
      intel: null,
      prose: "",
      queries: [],
      error: null,
      generatedAt: new Date().toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    })

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      })
      if (!res.body) throw new Error("No response stream")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          let ev: StreamEvent
          try {
            ev = JSON.parse(raw)
          } catch {
            continue
          }
          switch (ev.type) {
            case "geo":
              set({ geo: ev.place })
              break
            case "image":
              set({ images: ev.images })
              break
            case "safety":
              set({ bundle: ev.bundle })
              break
            case "enrichment":
              set({ intel: ev.data })
              break
            case "text":
              set((s) => ({ prose: s.prose + ev.content }))
              break
            case "searching":
              set((s) => ({ queries: [...s.queries, ev.query] }))
              break
            case "error":
              set({ error: ev.message, status: "error" })
              break
            case "done":
              set((s) => ({ status: s.status === "error" ? "error" : "done" }))
              break
          }
        }
      }
    } catch (err) {
      set({ error: String(err), status: "error" })
    } finally {
      set((s) => (s.status === "loading" ? { status: "done" } : {}))
    }
  },
}))
