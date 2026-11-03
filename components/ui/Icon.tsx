/** The drawn icons: one stroke weight, square ends, so they sit with the stepped corners. */
const PATHS = {
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
  chevron: "M9 5l7 7-7 7",
  arrow: "M4 12h15M13 6l6 6-6 6",
  check: "M4 13l5 5L20 7",
  cross: "M6 6l12 12M18 6L6 18",
  hold: "M9 11V5.5a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V11m0-.5a1.5 1.5 0 013 0V15c0 3.3-2.2 6-5.5 6-2.6 0-4-1.2-5.2-3L5 14.2c-.7-1.2 1-2.5 2-1.4L9 15",
  ghost: "M5 21V10a7 7 0 0114 0v11l-2.3-2-2.3 2-2.4-2-2.4 2-2.3-2zM9.5 10.5h.01M14.5 10.5h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
