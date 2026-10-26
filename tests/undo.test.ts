import { describe, expect, it } from "vitest";
import { undoState } from "@/lib/game/engine";
import { checkInvariants } from "@/lib/game/invariants";
import { findLeaks, allViewers } from "@/lib/game/leaks";
import { dealt } from "./helpers";

/** Undo (owner, 27 October): the host can take back a step, including the one that ended the game. */
describe("undo", () => {
  it("undoes a win before it's revealed, and the game carries on", () => {
    const g = dealt(12, { traitors: ["p1"], settings: { traitorCount: 1 } });
    g.circle();
    g.vote({ p2: "p1", p3: "p1", p4: "p5" });
    const before = g.state;
    const savedAt = g.now;
    g.reveal();
    expect(g.phase).toBe("FINALE");
    expect(g.state.finale).toMatchObject({ winner: "innocents", revealed: false });
    const current = g.state;
    g.now += 30_000;
    const next = undoState(current, before, { at: g.now, reason: "Wrong ballot entered", summary: "Show the result", targetSavedAt: savedAt });
    expect(next.version).toBe(current.version + 1);
    expect(next.phase).toBe("CIRCLE_REVEAL");
    expect(next.finale).toBeNull();
    expect(next.players.find((p) => p.id === "p1")!.status).toBe("alive");
    expect(next.log.length).toBe(current.log.length + 1);
    expect(next.log[next.log.length - 1]).toMatchObject({ action: "undo", override: true, reason: "Wrong ballot entered" });
    expect(next.events.some((e) => e.type === "banished")).toBe(false);
    expect(next.events[next.events.length - 1].type).toBe("undone");
    expect(next.nextId).toBeGreaterThan(current.nextId - 1);
    expect(checkInvariants(next)).toEqual([]);
    for (const v of allViewers(next)) expect(findLeaks(next, v)).toEqual([]);
    // Keep playing: the host reruns the vote.
    g.state = next;
    g.host({ type: "rerunVote", reason: "Revote after the mistake" });
    expect(g.phase).toBe("CIRCLE_VOTE");
  });

  it("gives timers back the time they had", () => {
    const g = dealt(12);
    g.host({ type: "openCircle" });
    const before = g.state;
    const savedAt = g.now;
    const leftThen = before.deadline! - savedAt;
    g.host({ type: "openVoting" });
    g.now += 300_000;
    const next = undoState(g.state, before, { at: g.now, reason: "Too early", summary: "Opened voting", targetSavedAt: savedAt });
    expect(next.phase).toBe("CIRCLE_DEBATE");
    expect(next.deadline! - g.now).toBe(leftThen);
  });

  it("is off once the result is revealed, and needs a reason", () => {
    const g = dealt(12);
    const before = g.state;
    g.host({ type: "endGameEarly", reason: "Test" });
    expect(() => undoState(g.state, before, { at: g.now, reason: "", summary: "x", targetSavedAt: g.now })).toThrow(/reason/);
    g.host({ type: "revealFinale" });
    expect(() => undoState(g.state, before, { at: g.now, reason: "Oops", summary: "x", targetSavedAt: g.now })).toThrow(/revealed/);
  });
});
