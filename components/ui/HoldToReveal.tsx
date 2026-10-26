"use client";

import { useState, type ReactNode } from "react";

/**
 * Secret screens stay neutral until held (section "Design"). Content shows only while pressed,
 * so a glance over a shoulder sees nothing.
 */
export function HoldToReveal({
  label = "Hold to see your role",
  onReveal,
  children,
}: {
  label?: string;
  onReveal?: () => void;
  children: ReactNode;
}) {
  const [held, setHeld] = useState(false);
  const start = () => {
    setHeld(true);
    onReveal?.();
  };
  const stop = () => setHeld(false);
  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && start()}
      onKeyUp={stop}
      onBlur={stop}
      className="relative flex min-h-56 w-full touch-none flex-col items-center justify-center overflow-hidden rounded-3xl border border-gold/30 bg-surface p-6 text-center select-none"
      style={{ WebkitTouchCallout: "none" }}
    >
      {held ? (
        children
      ) : (
        <>
          <span className="mb-3 grid size-16 place-items-center rounded-full border border-gold/40 text-3xl" aria-hidden>
            ☝︎
          </span>
          <span className="text-lg text-ink">{label}</span>
          <span className="mt-1 text-sm text-ink-muted">Let go to hide it again</span>
        </>
      )}
    </button>
  );
}
