"use client";

import type { GameHandle } from "@/lib/client/useGame";
import { useTicker } from "@/lib/client/useTicker";
import type { EventView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";

/**
 * The breakfast entrance (tier 2, from the original Dutch format): the survivors walk in one photo at
 * a time, in the engine's order; the last empty chair is the victim. Phones wait until it finishes.
 */
export function Entrance({ game, event, start }: { game: GameHandle; event: EventView; start: number }) {
  useTicker(100);
  const view = game.view!;
  const order = (event.data.entrance as string[]) ?? [];
  const ms = (event.data.entranceMs as number) || 1;
  const victim = view.players.find((p) => p.id === event.data.victimId);
  const chairs = order.length + (victim ? 1 : 0);
  const step = ms / (order.length + 2);
  const elapsed = game.now() - start;
  const arrived = Math.min(order.length, Math.floor(elapsed / step));
  const done = arrived >= order.length && elapsed >= step * (order.length + 1);
  const size = chairs > 14 ? "min(7vw,13vh)" : chairs > 9 ? "min(8.5vw,15vh)" : "min(11vw,19vh)";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[4vh] text-center">
      <h2 className="font-sign text-[min(7vw,8rem)] leading-none uppercase">Breakfast</h2>
      <p className="text-[min(2.4vw,2.4rem)] text-ink-muted">{view.settings.narration.breakfast}</p>
      <ul className="flex max-w-[90vw] flex-wrap justify-center gap-x-[2vw] gap-y-[3vh]">
        {Array.from({ length: chairs }, (_, i) => {
          const p = i < arrived ? view.players.find((x) => x.id === order[i]) : undefined;
          const victimChair = !!victim && i === order.length;
          const shown = p ?? (victimChair && done ? victim : undefined);
          return (
            <li key={i} className="flex flex-col items-center gap-[1vh]" style={{ width: `calc(${size} + 1rem)` }}>
              {shown ? (
                <div className="animate-arrive">
                  <Avatar name={shown.displayName} url={game.photoFor(shown.photoPath)} size={size} tall ghost={victimChair} />
                </div>
              ) : (
                <div className="step frame [--frame-fill:var(--ground)] [--frame-strength:60%]" style={{ width: size, aspectRatio: "5 / 6" }} />
              )}
              <span className={`w-full truncate text-[min(1.6vw,1.6rem)] ${victimChair ? "font-semibold text-danger-ink" : "text-ink"}`}>{shown?.displayName ?? ""}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[min(2.6vw,2.6rem)] text-ink">
        {done
          ? victim
            ? `${victim.displayName} never came down to breakfast.`
            : "Everyone made it to breakfast."
          : `${arrived} at the table…`}
      </p>
    </div>
  );
}
