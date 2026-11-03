"use client";

import { useEffect } from "react";
import type { GameView } from "@/lib/game/view";

export type Act = "day" | "circle" | "night" | "innocents" | "traitors";

/** The room's act, from public state only: it must look the same on every screen, whoever is holding it. */
export function actOf(view: Pick<GameView, "phase" | "finale" | "finalePending"> | null): Act {
  if (!view || view.finalePending) return "day";
  if (view.phase === "FINALE") return view.finale?.winner === "traitors" ? "traitors" : view.finale ? "innocents" : "day";
  if (view.phase === "NIGHT") return "night";
  if (["CIRCLE_DEBATE", "CIRCLE_VOTE", "CIRCLE_REVEAL", "ENDGAME_VOTE", "ENDGAME_BANISH"].includes(view.phase)) return "circle";
  return "day";
}

/** Sets the act on the page, so every phone and the TV change colour together. */
export function useHouseLights(act: Act) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.act = act;
    // Once the fade ends, the phone's own browser bar follows.
    const t = setTimeout(() => {
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(root).getPropertyValue("--ground").trim());
    }, 1500);
    return () => {
      clearTimeout(t);
      delete root.dataset.act;
    };
  }, [act]);
}
