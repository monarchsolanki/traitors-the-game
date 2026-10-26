"use client";

import { useState } from "react";
import { PHASE_TITLE } from "@/lib/client/labels";
import type { GameHandle } from "@/lib/client/useGame";
import { Card, Toggle } from "@/components/ui/Field";
import { playerById } from "@/components/player/shared";

/** Everything that happened, newest first: who, when, what and why (section 4.3). Host only. */
export function LogPanel({ game }: { game: GameHandle }) {
  const view = game.view!;
  const [overridesOnly, setOverridesOnly] = useState(false);
  const [limit, setLimit] = useState(100);
  const all = [...view.host!.log].reverse();
  const entries = (overridesOnly ? all.filter((l) => l.override) : all).slice(0, limit);
  const who = (a: (typeof all)[number]["actor"]) =>
    a.kind === "host" ? "Host" : a.kind === "system" ? "Timer" : playerById(view, a.playerId)?.displayName ?? "Player";
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Toggle label="Only host fixes" hint={`${all.filter((l) => l.override).length} fixes, ${all.length} entries in all`} checked={overridesOnly} onChange={setOverridesOnly} />
      </Card>
      <ul className="flex flex-col gap-2">
        {entries.map((l) => (
          <li key={l.id} className={`rounded-2xl px-4 py-3 ${l.override ? "bg-marigold/10 ring-1 ring-marigold/40" : "bg-surface"}`}>
            <p className="text-sm text-ink-muted">
              {new Date(l.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Day {l.day} · {PHASE_TITLE[l.phase]} ·{" "}
              <span className="text-ink">{who(l.actor)}</span>
              {l.override ? <span className="ml-2 rounded-full bg-marigold/30 px-2 text-xs text-marigold">fix</span> : null}
            </p>
            <p className="text-ink">{l.summary}</p>
            {l.reason ? <p className="text-sm text-ink-muted italic">Reason: {l.reason}</p> : null}
          </li>
        ))}
      </ul>
      {entries.length >= limit ? (
        <button type="button" className="py-3 text-gold" onClick={() => setLimit((n) => n + 100)}>
          Show older entries
        </button>
      ) : null}
    </div>
  );
}
