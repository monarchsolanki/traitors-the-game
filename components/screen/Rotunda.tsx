"use client";

import type { GameHandle } from "@/lib/client/useGame";
import type { RoundView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

const RING = "min(66vh,44vw)";
const R = 84;

/** The Circle as a real circle: everyone seated on a ring, each revealed vote drawn across it, the newest at full strength. */
export function Rotunda({ game, round }: { game: GameHandle; round: RoundView }) {
  const view = game.view!;
  const seats = view.players;
  const at = (id: string | null) => {
    const i = seats.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const a = -Math.PI / 2 + (i / seats.length) * Math.PI * 2;
    return { x: Math.cos(a) * R, y: Math.sin(a) * R };
  };
  const latest = round.ballots[round.ballots.length - 1];
  // Square seats on a ring: past 12 players they shrink so neighbours don't overlap (the maximum is 20).
  const seat = `calc(${RING} * ${Math.min(0.15, 0.59 * Math.sin(Math.PI / seats.length))})`;
  const name = (id: string | null) => seats.find((p) => p.id === id)?.displayName;
  return (
    <div className="relative aspect-square shrink-0" style={{ width: RING }}>
      <svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full" aria-hidden="true">
        <circle r={R} fill="none" stroke="var(--line)" strokeWidth="0.4" opacity="0.4" />
        {round.ballots.map((b) => {
          const from = at(b.voterId);
          const to = at(b.targetId);
          if (!from || !to) return null;
          const newest = b === latest;
          return (
            <path
              key={b.voterId}
              d={`M${from.x} ${from.y}Q${(from.x + to.x) * 0.2} ${(from.y + to.y) * 0.2} ${to.x} ${to.y}`}
              pathLength={1}
              fill="none"
              stroke={newest ? "var(--accent)" : "var(--line)"}
              strokeWidth={(newest ? 1.1 : 0.5) * b.weight}
              strokeDasharray="1"
              opacity={newest ? 1 : 0.4}
              className={newest ? "animate-draw" : undefined}
            />
          );
        })}
      </svg>
      {seats.map((p) => {
        const pos = at(p.id)!;
        const lit = latest && (p.id === latest.voterId || p.id === latest.targetId);
        return (
          <div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + pos.x / 2}%`, top: `${50 + pos.y / 2}%` }}>
            <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size={seat} ghost={p.status !== "alive"} ring={!!lit} />
          </div>
        );
      })}
      <div className="absolute inset-[20%] flex flex-col items-center justify-center gap-[0.8vh] text-center">
        <p className="bg-ground px-[0.5vw] text-[min(1.7vw,1.7rem)] text-ink-muted">
          Vote {round.ballots.length} of {round.ballotCount ?? round.ballots.length}
        </p>
        {latest ? (
          <div key={latest.voterId} className="flex animate-settle flex-col items-center gap-[0.4vh] font-display text-[min(2.8vw,2.8rem)] leading-tight">
            <span className="bg-ground px-[0.5vw]">{name(latest.voterId)}</span>
            {latest.ghost ? <span className="bg-ground px-[0.5vw] text-[min(1.5vw,1.5rem)] text-ghost">ghost vote</span> : null}
            <Icon name="arrow" className="size-[min(3vw,3rem)] rotate-90 text-accent" />
            <span className={`bg-ground px-[0.5vw] ${latest.choice === "banish" ? "text-danger-ink" : "text-accent"}`}>
              {latest.choice ? (latest.choice === "end" ? "End" : "Banish") : name(latest.targetId)}
              {latest.usedDagger ? ` ×${latest.weight}` : ""}
            </span>
          </div>
        ) : (
          <p className="bg-ground px-[0.5vw] font-display text-[min(3.4vw,3.4rem)] leading-tight">The votes are in</p>
        )}
      </div>
    </div>
  );
}
