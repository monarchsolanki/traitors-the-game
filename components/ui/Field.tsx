import type { InputHTMLAttributes, ReactNode } from "react";

export function TextField({
  label,
  hint,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-muted">{label}</span>
      <input
        className="min-h-12 rounded-xl border border-gold/25 bg-night px-4 text-lg text-ink placeholder:text-ink-muted/50 focus:border-gold focus:outline-none"
        {...rest}
      />
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <span className="flex flex-col">
        <span className="text-base text-ink">{label}</span>
        {hint ? <span className="text-sm text-ink-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-gold" : "bg-surface-2 ring-1 ring-gold/25"}`}
      >
        <span className={`absolute top-1 size-6 rounded-full bg-ink transition ${checked ? "left-7" : "left-1"}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 py-3 ${disabled ? "opacity-50" : ""}`}>
      <span className="flex flex-col">
        <span className="text-base text-ink">{label}</span>
        {hint ? <span className="text-sm text-ink-muted">{hint}</span> : null}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-xl px-4 text-base transition ${o.value === value ? "bg-gold font-semibold text-night" : "bg-surface-2 text-ink ring-1 ring-gold/20"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(v),
  onChange,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <span className="flex flex-col">
        <span className="text-base text-ink">{label}</span>
        {hint ? <span className="text-sm text-ink-muted">{hint}</span> : null}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label={`Less ${label}`}
          disabled={disabled || value - step < min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="grid size-11 place-items-center rounded-xl bg-surface-2 text-xl text-ink ring-1 ring-gold/20 disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-14 text-center font-mono text-lg tabular-nums text-gold">{format(value)}</span>
        <button
          type="button"
          aria-label={`More ${label}`}
          disabled={disabled || value + step > max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="grid size-11 place-items-center rounded-xl bg-surface-2 text-xl text-ink ring-1 ring-gold/20 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-gold/15 bg-surface p-5 ${className}`}>{children}</section>;
}

export function Notice({ title, children, tone = "plain" }: { title?: string; children?: ReactNode; tone?: "plain" | "warn" }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-base ${tone === "warn" ? "bg-kumkum/15 text-ink ring-1 ring-kumkum/40" : "bg-surface-2 text-ink-muted"}`}>
      {title ? <p className="font-semibold text-ink">{title}</p> : null}
      {children}
    </div>
  );
}
