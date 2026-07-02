"use client"

export function SectionHeader({
  num,
  title,
  note,
}: {
  num: string
  title: string
  note?: string
}) {
  return (
    <div className="section-head">
      <span className="section-num">{num}</span>
      <span className="section-title">{title}</span>
      <span className="section-rule" />
      {note && <span className="section-note">{note}</span>}
    </div>
  )
}
