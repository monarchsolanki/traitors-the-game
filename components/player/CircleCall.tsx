"use client";

import { useEffect, useRef, useState } from "react";
import type { GameHandle } from "@/lib/client/useGame";
import { Button } from "@/components/ui/Button";

const FRESH_MS = 60_000;

function chime(ctx: AudioContext) {
  const t = ctx.currentTime + 0.02;
  [660, 880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t + i * 0.22);
    g.gain.setValueAtTime(0.0001, t + i * 0.22);
    g.gain.exponentialRampToValueAtTime(0.35, t + i * 0.22 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.7);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t + i * 0.22);
    o.stop(t + i * 0.22 + 0.75);
  });
}

/**
 * Owner, 30 October: when private talks end, every phone calls its player back to the Circle. Android
 * vibrates; iPhones can't vibrate from a website, so every phone also shows a full-screen card and plays
 * a chime (browsers allow sound only after the player has tapped the page once, which joining does).
 * A phone that is locked or in a pocket with the screen off can't be woken by a website.
 */
export function CircleCall({ game }: { game: GameHandle }) {
  const view = game.view!;
  const audio = useRef<AudioContext | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    const unlock = () => {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {
        audio.current = null;
      }
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const call = [...view.events].reverse().find((e) => e.type === "circleOpened" && e.data.afterTalks);
  const fresh = !!call && game.now() - (game.seenAt(call.id) ?? call.at) < FRESH_MS;
  const callId = fresh ? call!.id : null;

  useEffect(() => {
    if (!callId) return;
    try {
      navigator.vibrate?.([400, 200, 400, 200, 800]);
    } catch {
      // Not supported (iPhone): the card and chime do the job.
    }
    if (audio.current) chime(audio.current);
  }, [callId]);

  if (!callId || dismissed === callId || view.phase === "FINALE") return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-ground px-8 text-center" role="alertdialog" aria-live="assertive">
      <div className="relative size-24" aria-hidden>
        <div className="step absolute inset-0 animate-call bg-accent [--s:9px]" />
        <div className="step absolute inset-5 bg-accent [--s:5px]" />
      </div>
      <p className="font-display text-[3rem] leading-[1.05] text-accent">Private talks are over</p>
      <p className="text-xl text-ink">Come to the Circle of Shaq now.</p>
      <Button className="w-full max-w-xs" onClick={() => setDismissed(callId)}>
        I&apos;m coming
      </Button>
    </div>
  );
}
