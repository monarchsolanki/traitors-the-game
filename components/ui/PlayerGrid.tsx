import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export interface GridPlayer {
  id: string;
  displayName: string;
  photoUrl: string | null;
  ghost?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  note?: string;
}

/** The guest wall. Portraits fill their column; `size` under 60 means a denser wall for sheets and panels. */
export function PlayerGrid({
  players,
  selectedId,
  selectedIds,
  onSelect,
  size = 72,
}: {
  players: GridPlayer[];
  selectedId?: string | null;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  size?: number;
}) {
  return (
    <ul className={`grid gap-x-3 gap-y-4 ${size < 60 ? "grid-cols-4 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]" : "grid-cols-3 sm:grid-cols-4"}`}>
      {players.map((p) => {
        const selected = p.id === selectedId || !!selectedIds?.includes(p.id);
        return (
          <li key={p.id}>
            <button
              type="button"
              disabled={!onSelect || p.disabled}
              onClick={() => onSelect?.(p.id)}
              className="flex w-full flex-col items-center gap-1.5 text-center transition active:scale-95 disabled:active:scale-100"
              aria-pressed={selected}
            >
              <div className="relative w-full">
                <Avatar name={p.displayName} url={p.photoUrl} size="fill" tall ghost={p.ghost || p.disabled} ring={selected} />
                {selected ? (
                  <span className="step absolute top-1.5 left-1.5 grid size-6 place-items-center bg-accent text-on-accent [--s:3px]" aria-hidden>
                    <Icon name="check" className="size-4" />
                  </span>
                ) : null}
                {p.badge ? <span className="absolute right-1.5 bottom-1.5">{p.badge}</span> : null}
              </div>
              <span className={`w-full truncate leading-tight ${size < 60 ? "text-base" : "text-lg"} ${selected ? "font-semibold text-accent" : p.disabled ? "text-ink-muted" : "text-ink"}`}>
                {p.displayName}
              </span>
              {p.note ? <span className="-mt-1 text-base text-ink-muted">{p.note}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
