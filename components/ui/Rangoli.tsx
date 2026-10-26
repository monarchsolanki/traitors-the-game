const PETALS = Array.from({ length: 8 }, (_, i) => i * 45);
const DOTS = Array.from({ length: 16 }, (_, i) => i * 22.5);

export function Rangoli({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-100 -100 200 200" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle r="96" />
        <circle r="70" strokeDasharray="2 5" />
        <circle r="24" />
        {PETALS.map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d="M0-26C14-40 14-60 0-68-14-60-14-40 0-26z" />
            <path d="M0-74c6 6 6 12 0 16-6-4-6-10 0-16z" />
          </g>
        ))}
      </g>
      <g fill="currentColor">
        {DOTS.map((deg) => (
          <circle key={deg} r="2.2" transform={`rotate(${deg}) translate(0 -84)`} />
        ))}
        <circle r="4" />
      </g>
    </svg>
  );
}
