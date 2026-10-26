export function Toran({ className = "" }: { className?: string }) {
  return (
    <svg
      width="100%"
      height="44"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <pattern id="toran" width="48" height="44" patternUnits="userSpaceOnUse">
          <path d="M0 5q24 10 48 0" stroke="var(--gold)" strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
          <path
            d="M24 18c5 5 5 13 0 20-5-7-5-15 0-20z"
            fill="var(--leaf)"
            opacity="0.85"
          />
          <path d="M24 19v18" stroke="#0f1a07" strokeOpacity="0.45" strokeWidth="0.8" />
          <circle cx="24" cy="12" r="7" fill="var(--marigold)" />
          <circle cx="24" cy="12" r="4.2" fill="var(--gold)" />
          <circle cx="24" cy="12" r="1.6" fill="var(--marigold)" />
          <circle cx="0" cy="5" r="2" fill="var(--gold)" />
          <circle cx="48" cy="5" r="2" fill="var(--gold)" />
        </pattern>
      </defs>
      <rect width="100%" height="44" fill="url(#toran)" />
    </svg>
  );
}
