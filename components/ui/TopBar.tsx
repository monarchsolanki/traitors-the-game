"use client";

import type { ReactNode } from "react";
import type { Connection } from "@/lib/client/useGame";
import { Countdown } from "./Countdown";

const DOT: Record<Connection, { cls: string; label: string }> = {
  live: { cls: "bg-leaf", label: "Connected" },
  connecting: { cls: "bg-marigold animate-pulse", label: "Connecting" },
  offline: { cls: "bg-kumkum", label: "Offline" },
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
}: {
  title: string;
  subtitle?: string;
  deadline: number | null;
  pausedRemainingMs: number | null;
  paused: boolean;
  now: () => number;
  connection: Connection;
  right?: ReactNode;
}) {
  const dot = DOT[connection];
  return (
    <header className="sticky top-0 z-30 border-b border-gold/15 bg-night/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl leading-tight font-semibold text-gold">{title}</h1>
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <span className={`inline-block size-2 rounded-full ${dot.cls}`} aria-hidden />
            <span>{connection === "live" ? subtitle : dot.label}</span>
          </p>
        </div>
        {paused ? <span className="rounded-full bg-marigold/20 px-3 py-1 text-sm font-semibold text-marigold">Paused</span> : null}
        <Countdown deadline={deadline} pausedRemainingMs={pausedRemainingMs} now={now} className="text-2xl" />
        {right}
      </div>
    </header>
  );
}
