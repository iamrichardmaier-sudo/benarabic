interface WaznLogoProps {
  /** Pixel size of the mark. */
  size?: number;
  /** Show the "WAZN" wordmark beside the mark. */
  wordmark?: boolean;
  className?: string;
}

/**
 * The Wazn mark: a balance scale, the mīzān by which an Arabic word is weighed
 * against its pattern.
 *
 * Drawn geometrically rather than as traced calligraphy so it stays crisp at
 * favicon size, recolours with the theme, and never depends on a font being
 * loaded. The Arabic وزن is set in the app's Naskh face alongside it, which
 * renders genuine letterforms instead of an approximation of them.
 *
 * Colour is inherited (`currentColor`), so the same component works on light
 * and dark backgrounds without a second asset.
 */
const WaznLogo = ({ size = 28, wordmark = false, className = '' }: WaznLogoProps) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="Wazn"
      className="shrink-0"
    >
      {/* fulcrum finial */}
      <circle cx="20" cy="6.5" r="2.1" fill="currentColor" />
      {/* central post */}
      <path d="M20 8.5v22" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {/* beam */}
      <path d="M7 13h26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {/* base */}
      <path d="M13.5 31h13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {/* pans: shallow bowls hanging from each end of the beam */}
      <path
        d="M3 13.4l3.4 6.8a4.2 4.2 0 0 0 7.2 0L17 13.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M23 13.4l3.4 6.8a4.2 4.2 0 0 0 7.2 0L37 13.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
    {wordmark && (
      <span className="flex items-baseline gap-1.5">
        <span className="font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
          WAZN
        </span>
        <span
          className="font-arabic opacity-60"
          style={{ fontSize: size * 0.55 }}
          dir="rtl"
          aria-hidden="true"
        >
          وزن
        </span>
      </span>
    )}
  </span>
);

export default WaznLogo;
