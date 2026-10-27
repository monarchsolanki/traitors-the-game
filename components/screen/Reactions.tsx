"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/client/supabase";

/**
 * Live reactions: emoji ghosts send float up the big screen. The rows carry only the emoji and the
 * time (no sender), straight from Supabase Realtime, so they cost the game nothing.
 */
export function Reactions({ code, active }: { code: string; active: boolean }) {
  const [items, setItems] = useState<Array<{ id: number; emoji: string; x: number }>>([]);
  useEffect(() => {
    if (!active) return;
    const supabase = browserClient("player");
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const channel = supabase
      .channel(`reactions:${code}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_reactions", filter: `code=eq.${code}` }, (msg) => {
        const row = msg.new as { id: number; emoji: string };
        setItems((list) => [...list.slice(-40), { id: row.id, emoji: row.emoji, x: 4 + Math.random() * 88 }]);
        timers.push(setTimeout(() => setItems((list) => list.filter((i) => i.id !== row.id)), 4_400));
      })
      .subscribe();
    return () => {
      timers.forEach(clearTimeout);
      void supabase.removeChannel(channel);
    };
  }, [active, code]);
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {items.map((i) => (
        <span key={i.id} className="absolute bottom-[4vh] animate-float-up text-[min(6vw,6rem)]" style={{ left: `${i.x}%` }}>
          {i.emoji}
        </span>
      ))}
    </div>
  );
}
