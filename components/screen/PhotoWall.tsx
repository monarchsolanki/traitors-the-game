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
  flip = false,
}: {
  game: GameHandle;
  players: PlayerView[];
  size?: "sm" | "md" | "lg";
  lobby?: boolean;
  /** The final reveal: each card turns over in turn to show the role. */
  flip?: boolean;
}) {
  const px = size === "lg" ? "min(11vw,10rem)" : size === "md" ? "min(8vw,7.5rem)" : "min(6vw,5.5rem)";
  // Two even rows rather than a full row and a couple of orphans.
  // At the final reveal only the winning side stays at full strength.
  const losing = game.view?.finale?.winner === "traitors" ? "innocent" : "traitor";
  const perRow = players.length <= 7 ? players.length : Math.ceil(players.length / 2);
  return (
    <ul
      className="flex flex-wrap justify-center gap-x-[1.4vw] gap-y-[2vh]"
      style={{ maxWidth: `calc((${px} + 1rem + 1.4vw) * ${perRow})` }}
    >
      {players.map((p, i) => {
        const gone = p.status !== "alive";
        const dim = lobby ? !p.seatClaimed : gone;
        return (
          <li
            key={p.id}
            className={`flex flex-col items-center gap-[0.6vh] ${flip ? "animate-flip-in" : ""}`}
            style={{ width: `calc(${px} + 1rem)`, animationDelay: flip ? `${i * 350}ms` : undefined }}
          >
            <Avatar name={p.displayName} url={game.photoFor(p.photoPath)} size={px} tall ghost={dim} ring={p.role === "traitor"} className={flip && p.role === losing ? "opacity-55" : ""} />
            <span className={`w-full truncate text-center text-[min(1.6vw,1.6rem)] leading-tight ${dim ? "text-ink-muted" : "text-ink"}`}>{p.displayName}</span>
            {lobby ? (
              <span className={`text-[min(1.2vw,1.2rem)] ${p.seatClaimed ? "text-jade" : "text-ink-muted"}`}>{p.seatClaimed ? "Joined" : "Waiting"}</span>
            ) : (
              <span className="text-center text-[min(1.2vw,1.2rem)] leading-tight">
                {p.role ? <span className={`block ${p.role === "traitor" ? "font-display text-[min(2vw,2rem)] text-danger-ink" : "text-ink-muted"}`}>{p.role === "traitor" ? "Traitor" : "Innocent"}</span> : null}
                {gone ? <span className="block text-ink-muted">{OUT[p.status]}</span> : null}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
