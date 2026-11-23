'use client';

// Marca do CODNIX — C angular em hexagono, identidade propria.
export default function Logo({ size = 28, withText = false, textClass = '' }: { size?: number; withText?: boolean; textClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 no-select">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
        <path
          d="M24 2 L42 12 V36 L24 46 L6 36 V12 Z"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        <path
          d="M31 17 C29 14.5 26.5 13.2 23.5 13.2 C17.5 13.2 13.5 17.6 13.5 24 C13.5 30.4 17.5 34.8 23.5 34.8 C26.5 34.8 29 33.5 31 31 L27.5 27.5 C26.4 29 25.2 29.7 23.5 29.7 C20.6 29.7 18.7 27.4 18.7 24 C18.7 20.6 20.6 18.3 23.5 18.3 C25.2 18.3 26.4 19 27.5 20.5 Z"
          fill="#ffffff"
        />
      </svg>
      {withText && (
        <span className={`font-semibold tracking-[0.18em] ${textClass || 'text-ink'}`} style={{ fontSize: size * 0.42 }}>
          CODNIX
        </span>
      )}
    </span>
  );
}
