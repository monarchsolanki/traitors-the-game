"use client";

import { useState } from "react";
import Link from "next/link";
import { PHASE_TITLE } from "@/lib/client/labels";
import { useGame } from "@/lib/client/useGame";
import { TopBar } from "@/components/ui/TopBar";
import { GameControls } from "./GameControls";
import { PlayersPanel } from "./PlayersPanel";
import { SettingsPanel } from "./SettingsPanel";

type Tab = "game" | "players" | "settings";

export function HostApp({ code }: { code: string }) {
  const game = useGame(code.toUpperCase(), "host");
  const [tab, setTab] = useState<Tab>("game");
  const view = game.view;

  if (game.notFound || (!view && game.error)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-3xl text-gold">{game.notFound ? `No game called ${code.toUpperCase()}` : game.error}</p>
        <Link href="/host" className="text-gold underline">
          Go to the host page
        </Link>
      </main>
    );
  }
  if (!view?.host) return <main className="flex min-h-dvh items-center justify-center text-ink-muted">Opening the game…</main>;

  const dealt = view.startingPlayerCount !== null;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "game", label: "Game" },
    { id: "players", label: "Players" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title={PHASE_TITLE[view.phase]}
        subtitle={`Host · Room ${view.code}${dealt && view.phase !== "FINALE" ? ` · Day ${view.day}` : ""}`}
        deadline={view.deadline}
        pausedRemainingMs={view.pausedRemainingMs}
        paused={view.paused}
        now={game.now}
        connection={game.connection}
      />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-5 pb-32">
        {tab === "game" ? <GameControls game={game} /> : null}
        {tab === "players" ? <PlayersPanel game={game} /> : null}
        {tab === "settings" ? <SettingsPanel game={game} /> : null}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-xl">
          {tabs.map((t) => (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-16 w-full text-base font-medium ${tab === t.id ? "text-gold" : "text-ink-muted"}`}
                aria-current={tab === t.id}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
