"use client";

import { useEffect, useState } from "react";

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Counts down to a server deadline; shows the frozen time while paused. */
export function Countdown({
  deadline,
  pausedRemainingMs,
  now,
  className = "",
}: {
  deadline: number | null;
  pausedRemainingMs: number | null;
  now: () => number;
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
  return (
    <span className={`font-mono tabular-nums ${urgent ? "text-kumkum" : "text-gold"} ${className}`} aria-label="Time left">
      {formatClock(left)}
    </span>
  );
}
