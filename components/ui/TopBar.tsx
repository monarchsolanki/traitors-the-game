"use client";

import type { ReactNode } from "react";
import type { Connection } from "@/lib/client/useGame";
import { Countdown } from "./Countdown";

const DOT: Record<Connection, { cls: string; label: string }> = {
  live: { cls: "bg-jade", label: "Connected" },
  connecting: { cls: "bg-notice animate-pulse", label: "Connecting" },
  offline: { cls: "bg-danger-ink", label: "Offline" },
};

export function TopBar({
  title,
  subtitle,
  deadline,
  pausedRemainingMs,
  paused,
  now,
  connection,
  right,
  band,
}: {
  title: string;
  subtitle?: string;
  deadline: number | null;
  pausedRemainingMs: number | null;
  paused: boolean;
  now: () => number;
  connection: Connection;
  right?: ReactNode;
  /** Host panels keep one ground, so a band in the act's colour says where the room is. */
  band?: string;
}) {
  const dot = DOT[connection];
  return (
    <header className="sticky top-0 z-30 bg-ground pt-[env(safe-area-inset-top)]">
      {band ? <div className="h-1 transition-colors duration-1000" style={{ backgroundColor: band }} aria-hidden /> : null}
      <div className={`mx-auto flex items-center gap-3 px-4 py-2.5 ${band ? "" : "max-w-3xl"}`}>
        <div className="min-w-0 flex-1">
          <h1 className={`truncate leading-tight ${band ? "font-display text-2xl" : "text-lg font-medium"}`}>{title}</h1>
          <p className="flex items-center gap-2 text-base text-ink-muted">
            <span className={`inline-block size-2 ${dot.cls}`} aria-hidden />
            <span>{connection === "live" ? subtitle : dot.label}</span>
          </p>
        </div>
        {paused ? <span className="step bg-notice px-3 py-1 text-base font-semibold text-on-notice [--s:3px]">Paused</span> : null}
        <Countdown deadline={deadline} pausedRemainingMs={pausedRemainingMs} now={now} className="text-3xl" />
        {right}
      </div>
      <div className="speed-lines" aria-hidden />
    </header>
  );
}
