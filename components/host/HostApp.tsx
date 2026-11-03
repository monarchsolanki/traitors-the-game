"use client";

import { useState } from "react";
import Link from "next/link";
import { PHASE_TITLE } from "@/lib/client/labels";
import { useGame } from "@/lib/client/useGame";
import { actOf } from "@/lib/client/useHouseLights";
import { TopBar } from "@/components/ui/TopBar";
import { FixPanel } from "./FixPanel";
import { GameControls } from "./GameControls";
import { LogPanel } from "./LogPanel";
import { PlayersPanel } from "./PlayersPanel";
import { SettingsPanel } from "./SettingsPanel";

type Tab = "game" | "players" | "fix" | "log" | "settings";

export function HostApp({ code }: { code: string }) {
  const game = useGame(code.toUpperCase(), "host");
  const [tab, setTab] = useState<Tab>("game");
  const view = game.view;

  if (game.notFound || (!view && game.error)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-3xl">{game.notFound ? `No game called ${code.toUpperCase()}` : game.error}</p>
        <Link href="/host" className="min-h-12 py-3 text-accent underline underline-offset-4">
          Go to the host page
        </Link>
      </main>
    );
  }
  if (!view?.host) return <main className="flex min-h-dvh items-center justify-center text-ink-muted">Opening the game…</main>;

  const dealt = view.startingPlayerCount !== null;
  const band = `var(--act-${actOf(view)})`;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "game", label: "Game" },
    { id: "players", label: "Players" },
    { id: "fix", label: "Fix" },
    { id: "log", label: "Log" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div data-surface="operate" className="flex min-h-dvh flex-col">
      <TopBar
        title={PHASE_TITLE[view.phase]}
        subtitle={`Host · Room ${view.code}${dealt && view.phase !== "FINALE" ? ` · Day ${view.day}` : ""}`}
        deadline={view.deadline}
        pausedRemainingMs={view.pausedRemainingMs}
        paused={view.paused}
        now={game.now}
        connection={game.connection}
        band={band}
      />
      <div className="flex-1 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* The rail wears the act the room is in, so the host reads it without looking up. */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/30 bg-ground pb-[env(safe-area-inset-bottom)] transition-colors duration-1000 lg:sticky lg:top-[4.75rem] lg:h-[calc(100dvh-4.75rem)] lg:border-t-0 lg:bg-[var(--rail)] lg:pb-0" style={{ "--rail": band } as React.CSSProperties}>
          <ul className="mx-auto flex max-w-xl lg:max-w-none lg:flex-col lg:gap-1 lg:p-3">
            {tabs.map((t) => (
              <li key={t.id} className="flex-1 lg:flex-none">
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`min-h-16 w-full text-base font-medium lg:min-h-12 lg:px-4 lg:text-left ${tab === t.id ? "text-accent lg:bg-accent lg:text-on-accent" : "text-ink-muted hover:text-ink lg:text-ink"}`}
                  aria-current={tab === t.id}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="mx-auto w-full max-w-xl px-4 pt-5 pb-32 lg:max-w-5xl lg:px-8 lg:pb-10">
          {tab === "game" ? <GameControls game={game} /> : null}
          {tab === "players" ? <PlayersPanel game={game} /> : null}
          {tab === "fix" ? <FixPanel game={game} /> : null}
          {tab === "log" ? <LogPanel game={game} /> : null}
          {tab === "settings" ? <SettingsPanel game={game} /> : null}
        </main>
      </div>
    </div>
  );
}
