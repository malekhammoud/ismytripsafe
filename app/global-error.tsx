"use client"

import "./globals.css"

// Only reached when the root layout itself fails, so it replaces the layout
// entirely — own <html>/<body>, own styles, no shared chrome to lean on.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body style={{ background: "#eef2f8", color: "#141922" }}>
        <title>Something went wrong | IsMyTripSafe</title>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1.25rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#7f8b9c",
            }}
          >
            IsMyTripSafe<span style={{ color: "#f36c0a" }}>.com</span>
          </p>
          <h1 style={{ margin: "0.9rem 0 0", fontSize: "1.5rem", color: "#0b2049" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0.6rem 0 0", maxWidth: "26rem", lineHeight: 1.7, color: "#3e4756" }}>
            The site hit an error it couldn&apos;t recover from on its own.
            {error.digest ? ` Reference ${error.digest}.` : ""}
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.5rem",
              background: "#141922",
              color: "#eef2f8",
              border: "none",
              borderRadius: 14,
              padding: "0.7rem 1.3rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{ marginTop: "1rem", fontSize: "0.85rem", fontWeight: 500, color: "#14538f" }}
          >
            Go to the safety checker
          </a>
        </main>
      </body>
    </html>
  )
}
