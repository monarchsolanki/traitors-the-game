export function Diya({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="diya-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.55" />
          <stop offset="60%" stopColor="var(--marigold)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--marigold)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diya-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1b8" />
          <stop offset="45%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--marigold)" />
        </linearGradient>
        <linearGradient id="diya-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--gold-deep)" />
        </linearGradient>
      </defs>

      <circle cx="60" cy="46" r="40" fill="url(#diya-glow)" className="animate-glow" />

      <g className="flame animate-flicker">
        <path
          d="M60 14C67 28 74 38 74 49c0 9-6.3 16-14 16s-14-7-14-16c0-11 7-21 14-35z"
          fill="url(#diya-flame)"
        />
        <path
          d="M60 34c3.6 6.4 6.5 10.8 6.5 16 0 5-2.9 8.4-6.5 8.4s-6.5-3.4-6.5-8.4c0-5.2 2.9-9.6 6.5-16z"
          fill="#fff7d6"
          opacity="0.9"
        />
      </g>

      <path d="M60 64v6" stroke="#3a1d0c" strokeWidth="2.5" strokeLinecap="round" />

      <path
        d="M12 70c14-3 82-3 98-6-4 18-24 34-50 34S18 86 12 70z"
        fill="url(#diya-bowl)"
      />
      <path
        d="M12 70c14-3 82-3 98-6"
        stroke="#fff1b8"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        fill="none"
      />
      <g fill="var(--kumkum)">
        <circle cx="40" cy="82" r="2.4" />
        <circle cx="60" cy="86" r="2.8" />
        <circle cx="80" cy="82" r="2.4" />
      </g>
      <path d="M50 97h20l-3 6H53z" fill="var(--gold-deep)" />
    </svg>
  );
}
