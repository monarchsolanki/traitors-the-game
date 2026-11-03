"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";

function DoorPanel({ side, open }: { side: "l" | "r"; open: boolean }) {
  return (
    <div className={`door door-${side} ${open ? "open" : ""} absolute inset-y-0 w-1/2 bg-surface-2 ${side === "l" ? "left-0 border-r" : "right-0 border-l"} border-line/40`}>
      <svg className="absolute inset-0 size-full text-line opacity-30" aria-hidden="true">
        <defs>
          <pattern id={`door-${side}`} width="44" height="32" patternUnits="userSpaceOnUse" patternTransform={side === "r" ? "scale(-1 1)" : undefined}>
            <path d="M0 0l22 16L0 32M12 0l22 16-22 16M24 0l20 14.5M24 32l20-14.5" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#door-${side})`} />
      </svg>
    </div>
  );
}

/**
 * Secret screens stay neutral until held (section "Design"). The lift doors part while pressed and the
 * content exists only while pressed: it is gone before they close, so a glance over a shoulder sees nothing.
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
      className="step frame relative flex min-h-80 w-full touch-none flex-col items-center justify-center overflow-hidden p-6 text-center select-none [--frame-fill:var(--ground)] [--s:6px]"
      style={{ WebkitTouchCallout: "none" }}
    >
      {held ? <span className="animate-settle">{children}</span> : null}
      <DoorPanel side="l" open={held} />
      <DoorPanel side="r" open={held} />
      {held ? null : (
        <span className="step frame relative flex flex-col items-center gap-1 px-6 py-4 [--frame-fill:var(--ground)]">
          <Icon name="hold" className="mb-1 size-8 text-accent" />
          <span className="text-lg text-ink">{label}</span>
          <span className="text-lg text-ink-muted">Let go to hide it again</span>
        </span>
      )}
    </button>
  );
}
