import { describe, expect, it } from "vitest";
import { checkInvariants } from "@/lib/game/invariants";
import { findLeaks } from "@/lib/game/leaks";
import { viewFor } from "@/lib/game/view";
import { dealt } from "./helpers";

/** Bugs the bot simulator found on 26 October, kept as tests. */
describe("simulator regressions", () => {
  it("a player turned Traitor mid-night doesn't see the last Traitor's recruit offer", () => {
    const g = dealt(12, { settings: { recruitment: "lastTraitor", traitorCount: 2 }, traitors: ["p1", "p2"] });
    g.circle();
    g.banish("p2");
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    g.host({ type: "setRole", playerId: "p6", role: "traitor", reason: "Fixing a deal mistake" });
    const v = viewFor(g.state, { kind: "player", playerId: "p6" });
    expect(v.traitor!.night!.offer).toBeNull();
    expect(findLeaks(g.state, { kind: "player", playerId: "p6" })).toEqual([]);
  });

  it("ending the game mid-night leaves the night unresolved rather than half-resolved", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p5"] });
    g.circle();
    g.banish("p12");
    g.host({ type: "endGameEarly", reason: "Power cut" });
    expect(g.night().resolved).toBe(false);
    expect(checkInvariants(g.state)).toEqual([]);
  });

  it("rerunning a vote never leaves a player holding two daggers", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.by("p4", { type: "castVote", targetId: "p5", useDagger: true });
    g.host({ type: "giveItem", itemType: "dagger", playerId: "p4", reason: "Second mission win" });
    g.host({ type: "rerunVote", reason: "Mix-up" });
    expect(g.items("p4", "dagger").filter((i) => i.state === "held")).toHaveLength(1);
    expect(checkInvariants(g.state)).toEqual([]);
  });
});
