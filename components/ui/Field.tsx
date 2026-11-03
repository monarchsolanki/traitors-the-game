import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

export function TextField({
  label,
  hint,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-medium text-ink-muted">{label}</span>
      <input
        className="min-h-12 w-full border border-line/40 bg-ground px-4 text-lg text-ink placeholder:text-ink-muted/90 focus:border-accent focus:outline-none"
        {...rest}
      />
      {hint ? <span className="text-base leading-snug text-ink-muted">{hint}</span> : null}
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
        <span className="text-lg leading-snug text-ink">{label}</span>
        {hint ? <span className="text-base leading-snug text-ink-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`step relative mt-0.5 h-8 w-14 shrink-0 transition-colors [--s:3px] ${checked ? "bg-accent" : "frame [--frame-fill:var(--ground)]"}`}
      >
        <span className={`absolute top-1 h-6 w-5 transition-[left] ${checked ? "left-8 bg-on-accent" : "left-1 bg-line"}`} />
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
        <span className="text-lg leading-snug text-ink">{label}</span>
        {hint ? <span className="text-base leading-snug text-ink-muted">{hint}</span> : null}
      </span>
      <div className="flex flex-wrap border border-line/40" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            disabled={disabled}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`min-h-12 flex-1 px-3 text-base transition-colors ${o.value === value ? "bg-accent font-semibold text-on-accent" : "text-ink hover:bg-surface-2"}`}
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
        <span className="text-lg leading-snug text-ink">{label}</span>
        {hint ? <span className="text-base leading-snug text-ink-muted">{hint}</span> : null}
      </span>
      <div className="flex shrink-0 items-center border border-line/40">
        <button
          type="button"
          aria-label={`Less ${label}`}
          disabled={disabled || value - step < min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="grid size-12 place-items-center text-ink hover:bg-surface-2 disabled:opacity-40"
        >
          <Icon name="minus" />
        </button>
        <span className="min-w-16 border-x border-line/40 px-1 text-center text-lg leading-[3rem] font-medium text-accent tabular-nums">{format(value)}</span>
        <button
          type="button"
          aria-label={`More ${label}`}
          disabled={disabled || value + step > max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="grid size-12 place-items-center text-ink hover:bg-surface-2 disabled:opacity-40"
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`step frame p-5 [--frame-strength:32%] ${className}`}>{children}</section>;
}

export function Notice({ title, children, tone = "plain" }: { title?: string; children?: ReactNode; tone?: "plain" | "warn" }) {
  return (
    <div className={`step px-4 py-3 text-lg leading-snug ${tone === "warn" ? "frame text-ink [--frame-fill:var(--surface-2)] [--line:var(--danger-ink)] [--frame-strength:80%]" : "bg-surface text-ink-muted"}`}>
      {title ? <p className="font-semibold text-ink">{title}</p> : null}
      {children}
    </div>
  );
}
