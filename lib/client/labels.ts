import type { Phase } from "@/lib/game/types";

export const PHASE_TITLE: Record<Phase, string> = {
  LOBBY: "Getting ready",
  ROLES: "Roles are dealt",
  MISSION: "Mission",
  PRIVATE_TALKS: "Private talks",
  CIRCLE_DEBATE: "Circle of Shaq",
  CIRCLE_VOTE: "Vote",
  CIRCLE_REVEAL: "The votes",
  NIGHT: "Night falls",
  MURDER_REVEAL: "Breakfast",
  ENDGAME_VOTE: "End Game",
  ENDGAME_BANISH: "End Game: banish",
  FINALE: "The final reveal",
};

export function itemLabel(type: "shield" | "dagger"): string {
  return type === "shield" ? "Shield" : "Dagger";
}

export function itemHelp(type: "shield" | "dagger", daggerWeight: number): string {
  return type === "shield"
    ? "Protects you from tonight's murder. It lasts one night."
    : `At one standard Circle, your vote counts ×${daggerWeight}. One use.`;
}

/** A typed or pasted guest list: one name per line or comma, with numbering and bullets dropped. */
export function splitNames(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}
