import type { GameHandle } from "@/lib/client/useGame";
import type { PlayerView } from "@/lib/game/view";
import { Avatar } from "@/components/ui/Avatar";

const OUT: Record<string, string> = { murdered: "Murdered", banished: "Banished", left: "Left" };

/** Everyone in the game: the living bright, the gone greyed with how they left. Roles only when public. */
export function PhotoWall({
  game,
  players,
  size = "md",
  lobby = false,
}: {
  game: GameHandle;
  players: PlayerView[];
  size?: "sm" | "md" | "lg";
  lobby?: boolean;
}) {
  const px = size === "lg" ? "min(11vw,10rem)" : size === "md" ? "min(8vw,7.5rem)" : "min(5.5vw,5rem)";
  return (
    <ul className="flex flex-wrap justify-center gap-x-[2vw] gap-y-[2.5vh]">
      {players.map((p) => {
        const gone = p.status !== "alive";
        const dim = lobby ? !p.seatClaimed : gone;
        return (
          <li key={p.id} className="flex flex-col items-center gap-[0.8vh]" style={{ width: `calc(${px} + 1.5rem)` }}>
            <div className={`rounded-full ${p.role === "traitor" ? "ring-[0.35vw] ring-kumkum" : ""}`}>
              <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size={px} ghost={dim} />
            </div>
            <span className={`w-full truncate text-center text-[min(1.6vw,1.6rem)] leading-tight ${dim ? "text-ink-muted" : "text-ink"}`}>{p.displayName}</span>
            {lobby ? (
              <span className={`text-[min(1.1vw,1.1rem)] ${p.seatClaimed ? "text-leaf" : "text-ink-muted"}`}>{p.seatClaimed ? "Joined" : "Waiting"}</span>
            ) : (
              <span className="text-center text-[min(1.1vw,1.1rem)] leading-tight">
                {p.role ? <span className={p.role === "traitor" ? "font-semibold text-kumkum" : "text-ink-muted"}>{p.role === "traitor" ? "Traitor" : "Innocent"}</span> : null}
                {p.role && gone ? <span className="text-ink-muted"> · </span> : null}
                {gone ? <span className="text-ink-muted">{OUT[p.status]}</span> : null}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
