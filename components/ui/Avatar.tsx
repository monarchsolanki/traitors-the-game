const TONES = ["#5a2a1f", "#4a3416", "#2f3d22", "#3d2448", "#4d1f2b", "#273447"];

function tone(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({
  name,
  url,
  size = 64,
  ghost = false,
  ring = false,
  className = "",
}: {
  name: string;
  url: string | null;
  /** Pixels, or any CSS length (e.g. "min(8vw,7.5rem)") for screens that scale with the room. */
  size?: number | string;
  ghost?: boolean;
  ring?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${ring ? "ring-3 ring-gold ring-offset-2 ring-offset-night" : "ring-1 ring-gold/25"} ${ghost ? "opacity-45 grayscale" : ""} ${className}`}
      style={{ width: size, height: size, backgroundColor: url ? undefined : tone(name) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <span
          className="absolute inset-0 grid place-items-center font-display font-semibold text-gold"
          style={{ fontSize: typeof size === "number" ? size * 0.38 : `calc(${size} * 0.38)` }}
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}
