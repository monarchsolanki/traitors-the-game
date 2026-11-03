/** The mark: a keyhole inside a stepped plate. A closed door you were let past. */
export function Keyhole({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M14 2h36v6h6v6h6v36h-6v6h-6v6H14v-6H8v-6H2V14h6V8h6z"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M32 15a9 9 0 015.4 16.2L40 49H24l2.6-17.8A9 9 0 0132 15z" fill="var(--accent)" />
    </svg>
  );
}
