const TONES = ["--tone-1", "--tone-2", "--tone-3", "--tone-4", "--tone-5", "--tone-6"];

function tone(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `var(${TONES[h % TONES.length]})`;
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

/**
 * A portrait plate with the stepped corner. Pass a pixel width or any CSS length that resolves against the
 * viewport (e.g. "min(8vw,7.5rem)"), or "fill" to take the width of its column. `tall` shows more of the person.
 */
export function Avatar({
  name,
  url,
  size = 64,
  ghost = false,
  ring = false,
  tall = false,
  className = "",
}: {
  name: string;
  url: string | null;
  size?: number | string;
  ghost?: boolean;
  ring?: boolean;
  tall?: boolean;
  className?: string;
}) {
  const fill = size === "fill";
  const width = fill ? "100%" : typeof size === "number" ? `${size}px` : size;
  const step = fill ? "7px" : `calc(${width} * 0.06)`;
  const letters = fill ? "2.4rem" : `calc(${width} * 0.38)`;
  return (
    <div
      className={`step relative shrink-0 transition-[opacity,filter] duration-1000 ${ring ? "bg-accent p-[3px]" : ""} ${ghost ? "opacity-45 grayscale" : ""} ${className}`}
      style={{ width, aspectRatio: tall ? "5 / 6" : "1", "--s": step } as React.CSSProperties}
    >
      <div
        className="step relative size-full overflow-hidden"
        style={{ backgroundColor: url ? undefined : tone(name), "--s": step } as React.CSSProperties}
      >
        {url ? (
          // Absolute, so the plate's height comes from its ratio and not the photo's. Square plates are small: go in on the face.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={`absolute inset-0 size-full object-cover object-[50%_16%] ${tall ? "" : "origin-[50%_20%] scale-[1.5]"}`} draggable={false} />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-display text-on-tone" style={{ fontSize: letters }}>
            {initials(name)}
          </span>
        )}
      </div>
    </div>
  );
}
