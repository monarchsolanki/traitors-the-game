"use client";

import { useEffect, useState } from "react";

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Counts down to a server deadline; shows the frozen time while paused. Each digit sits in its own cell, so the clock doesn't jitter. */
export function Countdown({
  deadline,
  pausedRemainingMs,
  now,
  quiet = false,
  className = "",
}: {
  deadline: number | null;
  pausedRemainingMs: number | null;
  now: () => number;
  /** Takes the accent colour off, for a clock that shouldn't catch the eye. */
  quiet?: boolean;
  className?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [deadline]);
  const left = deadline !== null ? deadline - now() : pausedRemainingMs;
  if (left === null) return null;
  const urgent = deadline !== null && left < 15_000;
  const clock = formatClock(left);
  return (
    <span className={`inline-flex font-display leading-none ${quiet ? "text-ink-muted" : urgent ? "text-danger-ink" : "text-accent"} ${className}`} role="timer" aria-label={`Time left ${clock}`}>
      {clock.split("").map((c, i) => (
        <span key={i} className="inline-block text-center" style={{ width: c === ":" ? "0.34em" : "0.62em" }} aria-hidden>
          {c}
        </span>
      ))}
    </span>
  );
}
