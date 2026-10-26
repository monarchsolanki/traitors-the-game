import type { ReactNode } from "react";
import { Avatar } from "./Avatar";

export interface GridPlayer {
  id: string;
  displayName: string;
  photoUrl: string | null;
  ghost?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  note?: string;
}

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
    <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
      {players.map((p) => {
        const selected = p.id === selectedId || !!selectedIds?.includes(p.id);
        return (
          <li key={p.id}>
            <button
              type="button"
              disabled={!onSelect || p.disabled}
              onClick={() => onSelect?.(p.id)}
              className="flex w-full flex-col items-center gap-2 rounded-2xl p-1 text-center transition active:scale-95 disabled:active:scale-100"
              aria-pressed={selected}
            >
              <div className="relative">
                <Avatar name={p.displayName} url={p.photoUrl} size={size} ghost={p.ghost || p.disabled} ring={selected} />
                {p.badge ? <span className="absolute -right-1 -bottom-1">{p.badge}</span> : null}
              </div>
              <span className={`w-full truncate text-base leading-tight ${selected ? "font-semibold text-gold" : p.disabled ? "text-ink-muted" : "text-ink"}`}>
                {p.displayName}
              </span>
              {p.note ? <span className="-mt-1.5 text-xs text-ink-muted">{p.note}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
