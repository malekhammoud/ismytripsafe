/**
 * The IsMyTripSafe mark: the globe-and-plane emblem from the banner's wordmark
 * bar. Redrawn as vector — the artwork only has it at ~100px, which is too
 * small for anything but a footnote — so it stays sharp at any size, and it
 * carries its own navy disc so it reads on paper and on the dark report
 * masthead alike.
 */
export function Logo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <circle cx="33" cy="31" r="23" fill="#16304f" />
      {/* Meridians and parallels, all inside r=21.4 so nothing needs clipping */}
      <g stroke="#fff" strokeWidth={1.3} fill="none" strokeLinecap="round">
        <circle cx="33" cy="31" r="21.4" />
        <line x1="33" y1="9.6" x2="33" y2="52.4" />
        <ellipse cx="33" cy="31" rx="10.7" ry="21.4" />
        <line x1="11.6" y1="31" x2="54.4" y2="31" />
        <path d="M15.8 19.8 Q33 24.5 50.2 19.8" />
        <path d="M15.8 42.2 Q33 37.5 50.2 42.2" />
      </g>
      {/* The navy outline is what keeps the plane from fusing with the grid */}
      <g transform="translate(34.5 26.5) rotate(40) scale(0.72)">
        <path
          fill="#fff"
          stroke="#16304f"
          strokeWidth={2.2}
          strokeLinejoin="round"
          d="M0-18c2.2 0 3.4 4 3.6 8.5L17.5 1.5l1 3.3-14.9-1.4-.4 6.3 5.3 4 .3 2.3-6.2-1.6-1 4.3h-3.2l-1-4.3-6.2 1.6.3-2.3 5.3-4-.4-6.3-14.9 1.4 1-3.3L-3.6-9.5C-3.4-14-2.2-18 0-18Z"
        />
      </g>
      <path
        fill="#f47c1a"
        d="M4.8 35.4c1.2 5.2 5.6 8.6 11.8 9.2 8.6.8 17.8-4 24.4-11.8-7 6.2-15 9.6-22.4 9-5.6-.4-9.8-3-11.4-7.2Z"
      />
    </svg>
  )
}
