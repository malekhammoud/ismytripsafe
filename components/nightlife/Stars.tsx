export function Stars({ value, large = false }: { value: number | null; large?: boolean }) {
  if (value == null) return <span className="nl-unrated">Not enough data</span>
  const half = Math.round(value * 2) / 2
  return <span className={`nl-stars ${large ? "nl-stars-large" : ""}`} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
    {Array.from({ length: 5 }, (_, i) => <span key={i} className="nl-star"><span aria-hidden="true">☆</span><span aria-hidden="true" className="nl-star-fill" style={{ width: `${Math.max(0, Math.min(1, half - i)) * 100}%` }}>★</span></span>)}
  </span>
}
