"use client";

import { useEffect, useRef, useState } from "react";
import type { GameHandle } from "@/lib/client/useGame";

/**
 * Big-screen sounds (tier 3): a heartbeat while votes are open or being revealed, a soft chime for each
 * revealed ballot, and a gong on results. Synthesised with Web Audio, so there are no files to load.
 * Browsers only allow sound after a tap, so the screen has a Sound button; the choice is remembered.
 */
const GONG_EVENTS = new Set(["banished", "murderRevealed", "finale", "tie", "endgameResult", "spin", "bingo"]);
const STORE = "traitors-screen-sound";

function envelope(ctx: AudioContext, at: number, peak: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  g.connect(ctx.destination);
  return g;
}

function tone(ctx: AudioContext, freq: number, at: number, peak: number, decay: number, type: OscillatorType = "sine") {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.connect(envelope(ctx, at, peak, decay));
  o.start(at);
  o.stop(at + decay + 0.05);
}

function gong(ctx: AudioContext) {
  const t = ctx.currentTime + 0.02;
  [
    [98, 0.5, 5],
    [196 * 1.48, 0.18, 3.5],
    [98 * 2.76, 0.12, 2.6],
    [98 * 5.4, 0.05, 1.4],
  ].forEach(([f, p, d]) => tone(ctx, f, t, p, d));
}

function heartbeat(ctx: AudioContext) {
  const t = ctx.currentTime + 0.02;
  tone(ctx, 58, t, 0.6, 0.22);
  tone(ctx, 52, t + 0.24, 0.45, 0.26);
}

function chime(ctx: AudioContext) {
  const t = ctx.currentTime + 0.02;
  tone(ctx, 880, t, 0.08, 0.6, "triangle");
}

export function useScreenSounds(game: GameHandle) {
  const [ctx, setCtx] = useState<AudioContext | null>(null);
  const [wanted, setWanted] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(STORE) === "on";
    } catch {
      return false;
    }
  });
  const heard = useRef(new Set<string>());
  const revealed = useRef<{ id: string; n: number }>({ id: "", n: 0 });
  const view = game.view;

  const toggle = () => {
    const next = !(wanted && ctx);
    try {
      window.localStorage.setItem(STORE, next ? "on" : "off");
    } catch {
      // Private mode: the choice just isn't remembered.
    }
    setWanted(next);
    if (next) {
      const c = ctx ?? new AudioContext();
      void c.resume();
      setCtx(c);
      gong(c);
    }
  };

  // Results: a gong when a result first arrives (a breakfast entrance waits for its last chair).
  useEffect(() => {
    if (!view) return;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (const e of view.events) {
      if (heard.current.has(e.id)) continue;
      heard.current.add(e.id);
      if (!ctx || !wanted || !GONG_EVENTS.has(e.type)) continue;
      const age = game.now() - (game.seenAt(e.id) ?? e.at);
      if (age > 5_000) continue;
      const wait = e.type === "murderRevealed" && typeof e.data.entranceMs === "number" ? Math.max(0, e.data.entranceMs - age) : 0;
      timers.push(setTimeout(() => gong(ctx), wait));
    }
    return () => timers.forEach(clearTimeout);
  }, [ctx, game, view, wanted]);

  // A chime per revealed ballot.
  useEffect(() => {
    const r = view?.round;
    if (!r) return;
    const before = revealed.current;
    revealed.current = { id: r.id, n: r.revealedCount };
    if (ctx && wanted && before.id === r.id && r.revealedCount > before.n && r.status === "revealing") chime(ctx);
  }, [ctx, view?.round, wanted]);

  // Heartbeat while a vote is open or being revealed.
  const tense = !!view && !view.paused && !!view.round && (view.round.status === "open" || view.round.status === "revealing");
  useEffect(() => {
    if (!ctx || !wanted || !tense) return;
    heartbeat(ctx);
    const t = setInterval(() => heartbeat(ctx), 1_100);
    return () => clearInterval(t);
  }, [ctx, tense, wanted]);

  return { on: wanted && !!ctx, toggle };
}
