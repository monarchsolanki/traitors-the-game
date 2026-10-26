import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "quiet";
type Size = "lg" | "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "bg-gold text-night font-semibold shadow-[0_6px_24px_rgb(242_193_78/0.25)] hover:brightness-105",
  secondary: "border border-gold/40 bg-surface text-ink hover:border-gold/70",
  danger: "bg-kumkum text-ink font-semibold hover:brightness-110",
  quiet: "text-ink-muted hover:text-ink",
};

const SIZE: Record<Size, string> = {
  lg: "min-h-14 px-6 text-lg rounded-2xl w-full",
  md: "min-h-12 px-5 text-base rounded-xl",
  sm: "min-h-10 px-4 text-sm rounded-lg",
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
      className={`inline-flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}
