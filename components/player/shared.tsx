"use client";

import type { GameHandle } from "@/lib/client/useGame";
import type { GameView, PlayerView } from "@/lib/game/view";
import type { GridPlayer } from "@/components/ui/PlayerGrid";

export function gridPlayers(
  game: GameHandle,
  players: PlayerView[],
  extra: (p: PlayerView) => Partial<GridPlayer> = () => ({}),
): GridPlayer[] {
  return players.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    photoUrl: game.photoFor(p.photoPath),
    ghost: p.status !== "alive",
    ...extra(p),
  }));
}

export function playerById(view: GameView, id: string | null | undefined): PlayerView | undefined {
  return id ? view.players.find((p) => p.id === id) : undefined;
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="step frame px-4 py-3 text-lg text-ink [--frame-fill:var(--surface-2)] [--frame-strength:80%] [--line:var(--danger-ink)]">
      {message}
    </p>
  );
}
