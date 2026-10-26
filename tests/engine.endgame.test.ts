import { describe, expect, it } from "vitest";
import { HOST, as, dealt } from "./helpers";

/** Plays standard days, banishing the first listed alive Innocent each Circle and murdering another. */
function playUntilEndgame(g: ReturnType<typeof dealt>) {
  let guard = 0;
  while (g.phase !== "ENDGAME_VOTE" && g.phase !== "FINALE" && guard++ < 30) {
    if (g.phase === "ROLES" || g.phase === "MURDER_REVEAL") g.circle();
    const innocents = g.alive().filter((id) => g.state.roles[id] === "innocent");
    g.banish(innocents[innocents.length - 1]);
    if (g.phase === "NIGHT") {
      const left = g.alive().filter((id) => g.state.roles[id] === "innocent");
      g.pickAll(left[left.length - 1]);
      g.host({ type: "revealMurder" });
    }
  }
}

describe("win check after a banishment (section 5.2)", () => {
  it("no Traitors alive: Innocents win at once, even before the End Game", () => {
    const g = dealt(12, { traitors: ["p1"], settings: { traitorCount: 1 } });
    g.circle();
    g.banish("p1");
    expect(g.phase).toBe("FINALE");
    expect(g.state.finale).toMatchObject({ winner: "innocents" });
  });

  it("at or below the threshold after a Circle: End Game vote", () => {
    const g = dealt(12);
    playUntilEndgame(g);
    expect(g.phase).toBe("ENDGAME_VOTE");
    expect(g.alive().length).toBeLessThanOrEqual(6);
    expect(g.state.endgameStarted).toBe(true);
  });

  it("the threshold is checked only after a Circle banishment, never after a murder", () => {
    const g = dealt(10, { settings: { endGameThreshold: 8 } });
    g.circle();
    g.banish("p10");
    expect(g.phase).toBe("NIGHT");
    g.pickAll("p9");
    g.host({ type: "revealMurder" });
    expect(g.alive()).toHaveLength(8);
    expect(g.phase).toBe("MURDER_REVEAL");
    g.circle();
    g.banish("p8");
    expect(g.phase).toBe("ENDGAME_VOTE");
  });

  it("there is no day limit: days repeat until an end condition", () => {
    const g = dealt(20, { settings: { endGameThreshold: 2, traitorCount: 1 }, traitors: ["p1"] });
    let days = 0;
    while (g.phase !== "FINALE" && g.phase !== "ENDGAME_VOTE") {
      if (g.phase === "ROLES" || g.phase === "MURDER_REVEAL") {
        g.host({ type: "startMission", name: `Day ${g.state.day}`, kind: "individual" });
        g.host({ type: "awardItem", itemType: "shield", playerIds: g.alive().filter((id) => id !== "p1") });
        g.circle();
      }
      const innocents = g.alive().filter((id) => id !== "p1");
      g.banish(innocents[innocents.length - 1]);
      if (g.phase === "NIGHT") {
        g.pickAll(g.alive().find((id) => id !== "p1")!);
        g.host({ type: "revealMurder" });
        days++;
      }
    }
    expect(days).toBeGreaterThanOrEqual(15);
    expect(g.state.day).toBeGreaterThanOrEqual(16);
  });
});

describe("End Game (sections 5.1, 5.3, 5.5)", () => {
  const atEndgame = () => {
    const g = dealt(12);
    playUntilEndgame(g);
    expect(g.phase).toBe("ENDGAME_VOTE");
    return g;
  };

  it("unanimous End: the reveal; Traitors win if any Traitor is alive", () => {
    const g = atEndgame();
    for (const id of g.alive()) g.by(id, { type: "castEndgameVote", choice: "end" });
    g.reveal();
    expect(g.phase).toBe("FINALE");
    expect(g.state.finale!.winner).toBe("traitors");
  });

  it("any Banish vote: one more banishment (no daggers), then back to the End Game vote", () => {
    const g = atEndgame();
    const alive = g.alive();
    alive.forEach((id, i) => g.by(id, { type: "castEndgameVote", choice: i === 0 ? "banish" : "end" }));
    g.reveal();
    expect(g.phase).toBe("ENDGAME_BANISH");
    expect(g.round().kind).toBe("endgameBanish");
    expect(g.no(as(alive[0]), { type: "castVote", targetId: alive[1], useDagger: true })).toMatch(/standard Circle/);
    const target = g.alive().filter((id) => g.state.roles[id] === "innocent").pop()!;
    g.banish(target);
    expect(g.phase).toBe("ENDGAME_VOTE");
  });

  it("an abstention blocks a unanimous End", () => {
    const g = atEndgame();
    const [first, ...rest] = g.alive();
    void first;
    for (const id of rest) g.by(id, { type: "castEndgameVote", choice: "end" });
    g.host({ type: "lockVoting" });
    g.reveal();
    expect(g.phase).toBe("ENDGAME_BANISH");
  });

  it("End Game banishment ties follow the tie rule, with a revote and then a spin", () => {
    const g = atEndgame();
    const alive = g.alive();
    alive.forEach((id) => g.by(id, { type: "castEndgameVote", choice: "banish" }));
    g.reveal();
    g.vote({ [alive[0]]: alive[2], [alive[1]]: alive[3] });
    g.reveal();
    expect(g.round().result).toMatchObject({ outcome: "tie", method: "revote" });
    g.host({ type: "startRevote" });
    expect(g.round().kind).toBe("endgameRevote");
    expect(g.phase).toBe("ENDGAME_BANISH");
    g.vote({ [alive[0]]: alive[2], [alive[1]]: alive[3] });
    g.reveal();
    expect(g.round().result).toMatchObject({ method: "spin" });
    g.host({ type: "spinTie" });
    expect(["ENDGAME_VOTE", "FINALE"]).toContain(g.phase);
  });

  it("2 players left: the reveal; Traitors win if either is a Traitor", () => {
    const g = dealt(6, { traitors: ["p1"], settings: { traitorCount: 1, endGameThreshold: 5 } });
    g.circle();
    g.banish("p6");
    expect(g.phase).toBe("ENDGAME_VOTE");
    let guard = 0;
    while (g.phase !== "FINALE" && guard++ < 10) {
      const alive = g.alive();
      alive.forEach((id) => g.by(id, { type: "castEndgameVote", choice: "banish" }));
      g.reveal();
      g.banish(g.alive().filter((id) => id !== "p1").pop()!);
    }
    expect(g.alive()).toHaveLength(2);
    expect(g.state.finale!.winner).toBe("traitors");
  });
});

describe("winners (section 5.3, decided 26 October)", () => {
  it("eliminated players win with their team by default", () => {
    const g = dealt(12);
    g.circle();
    g.banish("p1");
    g.pickAll("p12");
    g.host({ type: "revealMurder" });
    g.host({ type: "endGameEarly", reason: "Test" });
    expect(g.state.finale!.winner).toBe("traitors");
    expect(g.state.finale!.winnerIds.sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("switched off, only living members of the winning team win", () => {
    const g = dealt(12, { settings: { eliminatedWinWithTeam: false } });
    g.circle();
    g.banish("p1");
    g.pickAll("p12");
    g.host({ type: "revealMurder" });
    g.host({ type: "endGameEarly", reason: "Test" });
    expect(g.state.finale!.winnerIds.sort()).toEqual(["p2", "p3"]);
  });

  it("Innocents' ghosts share the Innocents' win", () => {
    const g = dealt(12, { traitors: ["p1"], settings: { traitorCount: 1 } });
    g.circle();
    g.banish("p12");
    g.pickAll("p11");
    g.host({ type: "revealMurder" });
    g.circle();
    g.banish("p1");
    expect(g.state.finale!.winner).toBe("innocents");
    expect(g.state.finale!.winnerIds).toContain("p12");
    expect(g.state.finale!.winnerIds).toContain("p11");
    expect(g.state.finale!.winnerIds).not.toContain("p1");
  });

  it("the host ends the game early: reveal with the current state, logged as an override", () => {
    const g = dealt(12);
    expect(g.no(HOST, { type: "endGameEarly", reason: "" })).toMatch(/reason/);
    g.host({ type: "endGameEarly", reason: "Housie time" });
    expect(g.state.finale).toMatchObject({ winner: "traitors", early: true });
    expect(g.state.log[g.state.log.length - 1]).toMatchObject({ override: true, reason: "Housie time" });
    g.host({ type: "closeGame" });
    expect(g.no(HOST, { type: "pause" })).toMatch(/closed/);
  });
});
