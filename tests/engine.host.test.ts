import { describe, expect, it } from "vitest";
import { viewFor } from "@/lib/game/view";
import { HOST, SYSTEM, as, dealt } from "./helpers";

describe("pause, timers and the timer tick (sections 5.1, 9.3)", () => {
  it("pausing stops the timer; resuming restarts it with the time left", () => {
    const g = dealt(12);
    g.host({ type: "openCircle" });
    const left = g.state.deadline! - g.now;
    g.host({ type: "pause" });
    expect(g.state.deadline).toBeNull();
    expect(g.state.pausedRemainingMs).toBe(left - 1000);
    g.now += 45 * 60_000;
    expect(g.no(SYSTEM, { type: "tick" })).toMatch(/paused/);
    g.host({ type: "resume" });
    expect(g.state.deadline).toBe(g.now + left - 1000);
  });

  it("player actions wait while paused; the host can still act", () => {
    const g = dealt(12);
    g.circle();
    g.host({ type: "pause" });
    expect(g.no(as("p4"), { type: "castVote", targetId: "p5" })).toMatch(/paused/);
    g.host({ type: "lockVoting" });
  });

  it("the host extends or shortens a timer, never into the past", () => {
    const g = dealt(12);
    g.host({ type: "openCircle" });
    const d = g.state.deadline!;
    g.host({ type: "adjustTimer", deltaSeconds: 120 });
    expect(g.state.deadline).toBe(d + 120_000);
    g.host({ type: "adjustTimer", deltaSeconds: -3600 });
    expect(g.state.deadline).toBe(g.now);
    expect(g.no(HOST, { type: "adjustTimer", deltaSeconds: 0 })).toMatch(/1 second/);
  });

  it("a tick before the deadline does nothing", () => {
    const g = dealt(12);
    g.host({ type: "openCircle" });
    expect(g.no(SYSTEM, { type: "tick" })).toMatch(/hasn't run out/);
  });

  it("a tick with no timer does nothing", () => {
    const g = dealt(12);
    g.now += 10_000_000;
    expect(g.no(SYSTEM, { type: "tick" })).toMatch(/hasn't run out|Nothing/);
  });
});

describe("host overrides (section 4.3), all logged with a reason", () => {
  it("marks a player eliminated and revives them", () => {
    const g = dealt(12);
    expect(g.no(HOST, { type: "eliminatePlayer", playerId: "p5", status: "left", reason: "" })).toMatch(/reason/);
    g.host({ type: "eliminatePlayer", playerId: "p5", status: "left", reason: "Went home" });
    expect(g.p("p5").status).toBe("left");
    g.host({ type: "revivePlayer", playerId: "p5", reason: "Came back" });
    expect(g.p("p5").status).toBe("alive");
    expect(g.state.log.filter((l) => l.override)).toHaveLength(2);
  });

  it("eliminating the last Traitor ends the game for the Innocents", () => {
    const g = dealt(12, { traitors: ["p1"], settings: { traitorCount: 1 } });
    g.host({ type: "eliminatePlayer", playerId: "p1", status: "left", reason: "Felt ill" });
    expect(g.phase).toBe("FINALE");
    expect(g.state.finale!.winner).toBe("innocents");
  });

  it("changes a role after dealing only by override; the player must peek again", () => {
    const g = dealt(12);
    g.by("p5", { type: "acknowledgeRole" });
    g.host({ type: "setRole", playerId: "p5", role: "traitor", reason: "Dealt wrong" });
    expect(g.state.roles.p5).toBe("traitor");
    expect(g.state.roleSeen.p5).toBe(false);
    expect(g.no(HOST, { type: "setRole", playerId: "p5", role: "traitor", reason: "again" })).toMatch(/already/);
  });

  it("only the host performs overrides", () => {
    const g = dealt(12);
    expect(g.no(as("p1"), { type: "setRole", playerId: "p1", role: "innocent", reason: "please" })).toMatch(/Only the host/);
    expect(g.no(as("p1"), { type: "endGameEarly", reason: "bored" })).toMatch(/Only the host/);
  });

  it("every successful action lands in the action log with actor, time and phase", () => {
    const g = dealt(12);
    g.circle();
    g.by("p4", { type: "castVote", targetId: "p5" });
    const last = g.state.log[g.state.log.length - 1];
    expect(last).toMatchObject({ actor: { kind: "player", playerId: "p4" }, phase: "CIRCLE_VOTE", action: "castVote" });
    expect(typeof last.at).toBe("number");
  });
});

describe("edge cases (section 5.9)", () => {
  it("someone taps the wrong photo: the host resets the seat before dealing", () => {
    const g = dealt(12);
    g.host({ type: "resetSeat", playerId: "p4" });
    expect(g.p("p4").seatClaimed).toBe(false);
  });

  it("a phone refreshes mid-vote: a submitted ballot stands; a missing one is an abstention at lock", () => {
    const g = dealt(12);
    g.circle();
    g.by("p4", { type: "castVote", targetId: "p5" });
    const v = viewFor(g.state, { kind: "player", playerId: "p4" });
    expect(v.me!.vote).toMatchObject({ submitted: true, myBallot: { targetId: "p5" } });
    g.host({ type: "lockVoting" });
    expect(g.lastRound().ballots).toHaveLength(1);
  });

  it("a refresh during the role reveal: the role card is still there", () => {
    const g = dealt(12);
    g.by("p1", { type: "acknowledgeRole" });
    expect(viewFor(g.state, { kind: "player", playerId: "p1" }).me!.role).toBe("traitor");
  });

  it("a player eliminated while offline opens on the ghost screen", () => {
    const g = dealt(12);
    g.circle();
    g.banish("p12");
    expect(viewFor(g.state, { kind: "player", playerId: "p12" }).me!.isGhost).toBe(true);
  });

  it("a player tries to change a vote: not allowed", () => {
    const g = dealt(12);
    g.circle();
    g.by("p4", { type: "castVote", targetId: "p5" });
    expect(g.no(as("p4"), { type: "castVote", targetId: "p6" })).toMatch(/can't be changed/);
  });

  it("a dagger holder is offline: the dagger stays unused; the host enters the ballot without it", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.host({ type: "setBallot", voterId: "p4", targetId: "p5", reason: "Phone off" });
    expect(g.round().ballots[0]).toMatchObject({ usedDagger: false, weight: 1 });
    expect(g.items("p4", "dagger")[0].state).toBe("held");
  });

  it("a shield blocks the murder: nobody died, no elimination", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Don't Laugh", kind: "individual" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p5"] });
    g.circle();
    g.banish("p12");
    g.pickAll("p5");
    g.host({ type: "revealMurder" });
    expect(g.alive()).toHaveLength(11);
  });

  it("a recruit accepting during a phase change: the role changes only at the end of the night", () => {
    const g = dealt(12, { settings: { recruitment: "lastTraitor", traitorCount: 2 }, traitors: ["p1", "p2"] });
    g.circle();
    g.banish("p2");
    g.by("p1", { type: "nightPick", targetId: "p5", mode: "recruit" });
    expect(g.state.roles.p5).toBe("innocent");
    g.by("p5", { type: "answerRecruit", accept: true });
    expect(g.state.roles.p5).toBe("traitor");
    expect(g.phase).toBe("MURDER_REVEAL");
  });

  it("two taps at once: the second is rejected as stale (the engine accepts each action once)", () => {
    const g = dealt(12);
    g.circle();
    const before = g.state;
    const first = g.try(as("p4"), { type: "castVote", targetId: "p5" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    g.state = first.nextState;
    expect(g.no(as("p4"), { type: "castVote", targetId: "p5" })).toMatch(/already in/);
    expect(before.version + 1).toBe(g.state.version);
  });
});
