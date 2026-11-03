import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "quiet";
type Size = "lg" | "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "step bg-accent text-on-accent font-semibold hover:brightness-105 disabled:bg-surface-2 disabled:text-ink-muted disabled:opacity-100",
  secondary: "step frame text-ink [--frame-strength:70%] hover:[--frame-fill:var(--surface-2)]",
  danger: "step bg-danger text-on-danger font-semibold hover:brightness-110",
  quiet: "text-ink-muted underline-offset-4 hover:text-ink hover:underline",
};

const SIZE: Record<Size, string> = {
  lg: "min-h-14 px-6 text-lg w-full",
  md: "min-h-12 px-5 text-base",
  sm: "min-h-12 px-4 text-base",
};

export function Button({
  variant = "primary",
  size = "lg",
  busy = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 text-center transition active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}
