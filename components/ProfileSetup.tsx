"use client"

import { useState } from "react"
import {
  User,
  Heart,
  Baby,
  UsersRound,
  Landmark,
  MoonStar,
  Briefcase,
  Mountain,
  ArrowRight,
  MapPin,
  SlidersHorizontal,
  Venus,
  Mars,
  VenusAndMars,
  HelpCircle,
} from "lucide-react"
import {
  PARTY_OPTIONS,
  AGE_OPTIONS,
  STYLE_OPTIONS,
  GENDER_OPTIONS,
  type TravelerProfile,
  type PartyType,
  type TripStyle,
  type GenderMix,
  type ProfileOption,
} from "@/lib/profile"

const PARTY_ICONS: Record<PartyType, React.ReactNode> = {
  solo: <User size={15} strokeWidth={2.2} />,
  couple: <Heart size={15} strokeWidth={2.2} />,
  family: <Baby size={15} strokeWidth={2.2} />,
  group: <UsersRound size={15} strokeWidth={2.2} />,
}

const GENDER_ICONS: Record<GenderMix, React.ReactNode> = {
  female: <Venus size={15} strokeWidth={2.2} />,
  male: <Mars size={15} strokeWidth={2.2} />,
  mixed: <VenusAndMars size={15} strokeWidth={2.2} />,
  unspecified: <HelpCircle size={15} strokeWidth={2.2} />,
}

const STYLE_ICONS: Record<TripStyle, React.ReactNode> = {
  sightseeing: <Landmark size={15} strokeWidth={2.2} />,
  nightlife: <MoonStar size={15} strokeWidth={2.2} />,
  business: <Briefcase size={15} strokeWidth={2.2} />,
  outdoors: <Mountain size={15} strokeWidth={2.2} />,
}

function OptionChip<T extends string>({
  option,
  icon,
  selected,
  onSelect,
}: {
  option: ProfileOption<T>
  icon?: React.ReactNode
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex flex-col items-start gap-0.5 rounded-[12px] px-3.5 py-2.5 text-left transition-all"
      style={
        selected
          ? {
              background: "rgba(31,116,207,0.09)",
              border: "1.5px solid var(--accent)",
              boxShadow: "0 2px 12px -4px rgba(31,116,207,0.35)",
            }
          : {
              background: "rgba(255,255,255,0.6)",
              border: "1.5px solid var(--hairline)",
            }
      }
    >
      <span
        className="flex items-center gap-1.5 text-[0.86rem] font-semibold"
        style={{ color: selected ? "var(--accent-deep)" : "var(--ink)" }}
      >
        {icon && <span style={{ color: selected ? "var(--accent)" : "var(--ink-faint)" }}>{icon}</span>}
        {option.label}
      </span>
      {option.hint && (
        <span className="text-[0.68rem] leading-snug" style={{ color: "var(--ink-faint)" }}>
          {option.hint}
        </span>
      )}
    </button>
  )
}

function Question({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="label mb-2">{label}</p>
      {children}
      {note && (
        <p className="mt-2 text-[0.7rem] leading-snug" style={{ color: "var(--ink-faint)" }}>
          {note}
        </p>
      )}
    </div>
  )
}

/**
 * "Who's going?" — asked once, right after a destination is chosen. The
 * answers deterministically re-weight the final score (see lib/profile.ts):
 * the same answers for the same destination always give the same number.
 */
export function ProfileSetup({
  place,
  onConfirm,
  onSkip,
}: {
  place: string
  onConfirm: (profile: TravelerProfile) => void
  onSkip: () => void
}) {
  const [party, setParty] = useState<TravelerProfile["party"]>("solo")
  const [gender, setGender] = useState<TravelerProfile["gender"]>("unspecified")
  const [age, setAge] = useState<TravelerProfile["age"]>("30to49")
  const [style, setStyle] = useState<TravelerProfile["style"]>("sightseeing")

  return (
    <div className="card scale-in mx-auto w-full max-w-xl p-6 sm:p-8">
      <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white/60 px-3 py-1 text-[0.7rem] font-medium text-[var(--ink-soft)]">
        <MapPin size={11} style={{ color: "var(--accent)" }} />
        {place}
      </div>
      <h2 className="font-display mt-2 text-[1.6rem] font-medium leading-tight text-[var(--ink)]">
        Who&apos;s going?
      </h2>
      <p className="mt-1.5 text-[0.88rem] leading-relaxed text-[var(--ink-soft)]">
        Safety isn&apos;t one number. A woman travelling alone, a family with kids and
        a business trip face different risks — your answers re-weight the score and
        change which findings the report leads with.
      </p>

      <div className="mt-6 space-y-6">
        <Question label="Travelling as">
          <div className="grid grid-cols-2 gap-2">
            {PARTY_OPTIONS.map((o) => (
              <OptionChip key={o.value} option={o} icon={PARTY_ICONS[o.value]} selected={party === o.value} onSelect={() => setParty(o.value)} />
            ))}
          </div>
        </Question>

        <Question
          label="Who's in the party"
          note="Women travellers meet different street-level risk, so this re-weights the score and changes which findings the report leads with."
        >
          <div className="grid grid-cols-2 gap-2">
            {GENDER_OPTIONS.map((o) => (
              <OptionChip key={o.value} option={o} icon={GENDER_ICONS[o.value]} selected={gender === o.value} onSelect={() => setGender(o.value)} />
            ))}
          </div>
        </Question>

        <Question label="Age of the oldest traveller">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AGE_OPTIONS.map((o) => (
              <OptionChip key={o.value} option={o} selected={age === o.value} onSelect={() => setAge(o.value)} />
            ))}
          </div>
        </Question>

        <Question label="Trip style">
          <div className="grid grid-cols-2 gap-2">
            {STYLE_OPTIONS.map((o) => (
              <OptionChip key={o.value} option={o} icon={STYLE_ICONS[o.value]} selected={style === o.value} onSelect={() => setStyle(o.value)} />
            ))}
          </div>
        </Question>
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-[0.8rem] font-medium text-[var(--ink-faint)] underline-offset-2 transition-colors hover:text-[var(--ink-soft)] hover:underline"
        >
          Skip — general report
        </button>
        <button
          type="button"
          onClick={() => onConfirm({ party, gender, age, style })}
          className="btn inline-flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          <SlidersHorizontal size={14} />
          Build my report
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
