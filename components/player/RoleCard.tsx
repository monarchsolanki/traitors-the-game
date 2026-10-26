"use client";

import { useRef } from "react";
import { itemHelp, itemLabel } from "@/lib/client/labels";
import type { GameHandle } from "@/lib/client/useGame";
import { HoldToReveal } from "@/components/ui/HoldToReveal";
import { playerById } from "./shared";

/** The secret card: role, fellow Traitors and held items, shown only while held. */
export function RoleCard({ game }: { game: GameHandle }) {
  const view = game.view!;
  const me = view.me!;
  const acked = useRef(false);
  const traitor = me.role === "traitor";
  const held = me.items.filter((i) => i.state === "held");
  const fellows = (view.traitor?.fellowTraitorIds ?? []).map((id) => playerById(view, id)?.displayName).filter(Boolean);

  const onReveal = () => {
    if (!me.roleSeen && !acked.current) {
      acked.current = true;
      void game.act({ type: "acknowledgeRole" });
    }
  };

  return (
    <HoldToReveal onReveal={onReveal}>
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm tracking-[0.3em] text-ink-muted uppercase">{me.isGhost ? "You were" : "You are"}</span>
        <span className={`font-display text-6xl font-semibold ${traitor ? "text-kumkum" : "text-gold"}`}>
          {traitor ? "a Traitor" : "Innocent"}
        </span>
        <span className="max-w-xs text-base text-ink">
          {traitor
            ? "Murder at night. Survive to the end without being caught."
            : "Find the Traitors and banish them at the Circle."}
        </span>
        {traitor && fellows.length ? (
          <span className="text-base text-ink-muted">
            Fellow Traitors: <span className="text-ink">{fellows.join(", ")}</span>
          </span>
        ) : null}
        {held.length ? (
          <ul className="mt-2 flex flex-col gap-1 text-left">
            {held.map((i) => (
              <li key={i.id} className="text-sm text-ink">
                <span className="font-semibold text-gold">{itemLabel(i.type)}:</span> {itemHelp(i.type, view.settings.daggerWeight)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </HoldToReveal>
  );
}
