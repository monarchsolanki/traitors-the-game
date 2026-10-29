import { describe, expect, it } from "vitest";
import { viewFor } from "@/lib/game/view";
import { HOST, as, dealt } from "./helpers";

const base = (o: Parameters<typeof dealt>[1] = {}) => {
  const g = dealt(12, o);
  g.circle();
  return g;
};

describe("Circle flow (section 5.1)", () => {
  it("debate → vote → reveal → banishment → night", () => {
    const g = dealt(12);
    g.host({ type: "openCircle" });
    expect(g.phase).toBe("CIRCLE_DEBATE");
    expect(g.state.deadline).toBe(g.now + 720_000);
    g.host({ type: "openVoting" });
    expect(g.phase).toBe("CIRCLE_VOTE");
    g.banish("p4");
    expect(g.p("p4").status).toBe("banished");
    expect(g.p("p4").eliminatedDay).toBe(1);
    expect(g.phase).toBe("NIGHT");
  });

  it("the debate timer running out opens voting", () => {
    const g = dealt(12);
    g.host({ type: "openCircle" });
    g.expire();
    expect(g.phase).toBe("CIRCLE_VOTE");
  });

  it("voting closes by itself when every living ballot is in (no ghosts yet)", () => {
    const g = base();
    for (const id of g.alive()) g.by(id, { type: "castVote", targetId: id === "p5" ? "p6" : "p5" });
    expect(g.phase).toBe("CIRCLE_REVEAL");
  });

  it("the vote timer running out locks voting; missing ballots are abstentions", () => {
    const g = base();
    g.by("p1", { type: "castVote", targetId: "p5" });
    g.expire();
    expect(g.phase).toBe("CIRCLE_REVEAL");
    g.reveal();
    expect(g.p("p5").status).toBe("banished");
  });
});

describe("ballots (section 5.5)", () => {
  it("only living players vote, once, never for themselves; ballots are final", () => {
    const g = base();
    expect(g.no(as("p1"), { type: "castVote", targetId: "p1" })).toMatch(/yourself/);
    g.by("p1", { type: "castVote", targetId: "p5" });
    expect(g.no(as("p1"), { type: "castVote", targetId: "p6" })).toMatch(/can't be changed/);
    expect(g.no(HOST, { type: "castVote", targetId: "p6" })).toMatch(/Only a player/);
  });

  it("the host locking early lists the abstainers in the log", () => {
    const g = base();
    g.by("p1", { type: "castVote", targetId: "p5" });
    g.host({ type: "lockVoting" });
    expect(g.state.log[g.state.log.length - 1].summary).toMatch(/abstained: P2, P3/);
  });

  it("reveals ballots one by one in a seeded order, then resolves", () => {
    const g = base();
    g.vote({ p1: "p5", p2: "p5", p3: "p6" });
    expect(g.round().revealOrder).toHaveLength(3);
    g.host({ type: "revealNextBallot" });
    g.host({ type: "revealNextBallot" });
    g.host({ type: "revealNextBallot" });
    expect(g.no(HOST, { type: "revealNextBallot" })).toMatch(/already shown/);
    g.reveal();
    expect(g.p("p5").status).toBe("banished");
  });
});

describe("daggers (sections 5.5, 5.6)", () => {
  it("a dagger counts 2 by default and is used up", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Mystery Box", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.vote({ p4: "p6", p1: "p5" }, ["p4"]);
    expect(g.round().ballots.find((b) => b.voterId === "p4")).toMatchObject({ weight: 2, usedDagger: true });
    expect(g.items("p4", "dagger")[0].state).toBe("used");
    g.reveal();
    expect(g.p("p6").status).toBe("banished");
  });

  it("dagger weight 3 when the host sets it", () => {
    const g = dealt(12, { settings: { daggerWeight: 3 } });
    g.host({ type: "startMission", name: "Mystery Box", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.vote({ p4: "p6", p1: "p5", p2: "p5" }, ["p4"]);
    g.reveal();
    expect(g.lastRound().totals).toMatchObject({ p6: 3, p5: 2 });
    expect(g.p("p6").status).toBe("banished");
  });

  it("several dagger holders can each use their dagger at the same Circle", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Minute to Win It", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4", "p5", "p6"] });
    g.circle();
    g.vote({ p4: "p7", p5: "p7", p6: "p8", p1: "p8", p2: "p8", p3: "p8", p9: "p8" }, ["p4", "p5", "p6"]);
    g.reveal();
    expect(g.lastRound().totals).toMatchObject({ p7: 4, p8: 6 });
  });

  it("without a dagger you can't use one; an unused dagger stays for a later Circle", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    expect(g.no(as("p5"), { type: "castVote", targetId: "p6", useDagger: true })).toMatch(/don't hold a dagger/);
    g.banish("p6");
    expect(g.items("p4", "dagger")[0].state).toBe("held");
  });

  it("can't be used in a revote or the End Game", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    g.host({ type: "startRevote" });
    expect(g.round().kind).toBe("revote");
    expect(g.no(as("p4"), { type: "castVote", targetId: "p5", useDagger: true })).toMatch(/standard Circle/);
  });

  it("is lost when its holder is eliminated", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.banish("p4");
    expect(g.items("p4", "dagger")[0].state).toBe("lost");
  });
});

describe("ties (section 5.5)", () => {
  it("revote (default): revotes between the tied players; after the 3rd tie the host chooses spin or revote", () => {
    const g = base();
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.round().result).toMatchObject({ outcome: "tie", tiedIds: ["p5", "p6"], method: "revote" });
    expect(g.no(HOST, { type: "spinTie" })).toMatch(/isn't settled by a spin/);
    g.host({ type: "startRevote" });
    expect(g.phase).toBe("CIRCLE_VOTE");
    expect(g.round()).toMatchObject({ kind: "revote", candidateIds: ["p5", "p6"] });
    expect(g.round().eligibleVoterIds).toHaveLength(12);
    expect(g.no(as("p1"), { type: "castVote", targetId: "p7" })).toMatch(/on the ballot/);
    // 2nd tie: still an automatic revote, and it's a normal Circle revote (not an End Game one).
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.round().result).toMatchObject({ outcome: "tie", method: "revote" });
    expect(g.no(HOST, { type: "spinTie" })).toMatch(/isn't settled by a spin/);
    g.host({ type: "startRevote" });
    expect(g.round().kind).toBe("revote");
    expect(g.phase).toBe("CIRCLE_VOTE");
    // 3rd tie: the host chooses.
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.round().result).toMatchObject({ outcome: "tie", method: "choose" });
    g.host({ type: "spinTie" });
    const banished = g.state.players.filter((p) => p.status === "banished").map((p) => p.id);
    expect(banished).toHaveLength(1);
    expect(["p5", "p6"]).toContain(banished[0]);
    expect(g.phase).toBe("NIGHT");
  });

  it("revote: when the host chooses to vote again, it stays the host's choice after every further tie", () => {
    const g = base();
    for (let i = 0; i < 3; i++) {
      g.vote({ p1: "p5", p2: "p6" });
      g.reveal();
      if (i < 2) g.host({ type: "startRevote" });
    }
    expect(g.round().result).toMatchObject({ method: "choose" });
    g.host({ type: "startRevote" });
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.round().result).toMatchObject({ method: "choose" });
    g.host({ type: "startRevote" });
    g.vote({ p1: "p5", p2: "p5", p3: "p6" });
    g.reveal();
    expect(g.p("p5").status).toBe("banished");
  });

  it("revote: the number of revotes before the host's choice is a setting", () => {
    const g = base({ settings: { tieRevotesBeforeChoice: 1 } });
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.round().result).toMatchObject({ method: "revote" });
    g.host({ type: "startRevote" });
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.round().result).toMatchObject({ method: "choose" });
  });

  it("a revote with a clear winner banishes them", () => {
    const g = base();
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    g.host({ type: "startRevote" });
    g.vote({ p1: "p5", p2: "p5", p3: "p6" });
    g.reveal();
    expect(g.p("p5").status).toBe("banished");
  });

  it("spin: no revote", () => {
    const g = base({ settings: { tieRule: "spin" } });
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.round().result).toMatchObject({ method: "spin" });
    g.host({ type: "spinTie" });
    expect(g.phase).toBe("NIGHT");
  });

  it("hostDecides: the host picks among the tied players, logged", () => {
    const g = base({ settings: { tieRule: "hostDecides" } });
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.no(HOST, { type: "decideTie", playerId: "p7" })).toMatch(/tied players/);
    g.host({ type: "decideTie", playerId: "p6" });
    expect(g.p("p6").status).toBe("banished");
    expect(g.state.log.some((l) => l.action === "decideTie")).toBe(true);
  });

  it("deciding a tie outside hostDecides is an override with a reason", () => {
    const g = base();
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.no(HOST, { type: "decideTie", playerId: "p5" })).toMatch(/reason/);
    g.host({ type: "decideTie", playerId: "p5", reason: "Tied player left the room" });
    expect(g.p("p5").status).toBe("banished");
  });

  it("nobody voting is a tie between everyone on the ballot", () => {
    const g = base({ settings: { tieRule: "spin" } });
    g.host({ type: "lockVoting" });
    g.reveal();
    expect(g.round().result).toMatchObject({ outcome: "tie" });
    expect((g.round().result as { tiedIds: string[] }).tiedIds).toHaveLength(12);
  });
});

describe("host ballot tools (section 4.3)", () => {
  it("enters a missing ballot by hand (offline dagger holder: without the dagger), logged", () => {
    const g = base();
    expect(g.no(HOST, { type: "setBallot", voterId: "p4", targetId: "p5", reason: "" })).toMatch(/reason/);
    g.host({ type: "setBallot", voterId: "p4", targetId: "p5", reason: "Phone died" });
    const b = g.round().ballots.find((x) => x.voterId === "p4")!;
    expect(b).toMatchObject({ targetId: "p5", enteredByHost: true, usedDagger: false, weight: 1 });
    expect(g.state.log[g.state.log.length - 1].override).toBe(true);
  });

  it("corrects a ballot during the reveal", () => {
    const g = base();
    g.vote({ p1: "p5", p2: "p5", p3: "p6" });
    g.host({ type: "setBallot", voterId: "p1", targetId: "p6", reason: "Tapped the wrong photo" });
    g.host({ type: "setBallot", voterId: "p4", targetId: "p6", reason: "Late ballot" });
    g.reveal();
    expect(g.p("p6").status).toBe("banished");
  });

  it("reruns a vote and gives back daggers used in it", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p4"] });
    g.circle();
    g.vote({ p4: "p5" }, ["p4"]);
    g.host({ type: "rerunVote", reason: "Confusion" });
    expect(g.phase).toBe("CIRCLE_VOTE");
    expect(g.round().ballots).toHaveLength(0);
    expect(g.items("p4", "dagger")[0].state).toBe("held");
  });
});

describe("ghost vote (section 5.5, decided 26 October)", () => {
  /** p12 banished on day 1, then night with no murder, then a day-2 Circle. */
  const toDay2Circle = (settings = {}) => {
    const g = dealt(12, { settings });
    g.circle();
    g.banish("p12");
    g.host({ type: "resolveNight", targetId: null, reason: "Test: no murder" });
    g.host({ type: "revealMurder" });
    g.circle();
    return g;
  };

  it("a ghost can't vote at the Circle where they were banished", () => {
    const g = base();
    g.vote({ p1: "p12" });
    expect(g.round().ghostVoterIds).toEqual([]);
  });

  it("a ghost casts one vote at a later Circle; it counts 1 and shows as a ghost ballot", () => {
    const g = toDay2Circle();
    expect(g.round().ghostVoterIds).toEqual(["p12"]);
    expect(g.no(as("p12"), { type: "castVote", targetId: "p5", useDagger: true })).toMatch(/Ghosts don't hold daggers/);
    g.by("p12", { type: "castVote", targetId: "p5" });
    expect(g.round().ballots[0]).toMatchObject({ ghost: true, weight: 1 });
    expect(g.p("p12").ghostVoteUsed).toBe(true);
    g.banish("p5");
    expect(g.lastRound().totals!.p5).toBe(11);
  });

  it("only once per game", () => {
    const g = toDay2Circle();
    g.by("p12", { type: "castVote", targetId: "p5" });
    g.banish("p5");
    g.host({ type: "resolveNight", targetId: null, reason: "Test" });
    g.host({ type: "revealMurder" });
    g.circle();
    expect(g.round().ghostVoterIds).not.toContain("p12");
    expect(g.no(as("p12"), { type: "castVote", targetId: "p6" })).toMatch(/already used/);
  });

  it("an unused ghost vote carries over to a later Circle", () => {
    const g = toDay2Circle();
    g.banish("p11");
    g.host({ type: "resolveNight", targetId: null, reason: "Test" });
    g.host({ type: "revealMurder" });
    g.circle();
    expect(g.round().ghostVoterIds.sort()).toEqual(["p11", "p12"]);
  });

  it("voting stays open while a ghost could still vote; the host locks it", () => {
    const g = toDay2Circle();
    for (const id of g.alive()) g.by(id, { type: "castVote", targetId: id === "p5" ? "p6" : "p5" });
    expect(g.phase).toBe("CIRCLE_VOTE");
    g.host({ type: "lockVoting" });
    expect(g.phase).toBe("CIRCLE_REVEAL");
  });

  it("voting closes by itself once every ghost has voted too", () => {
    const g = toDay2Circle();
    g.by("p12", { type: "castVote", targetId: "p5" });
    for (const id of g.alive()) g.by(id, { type: "castVote", targetId: id === "p5" ? "p6" : "p5" });
    expect(g.phase).toBe("CIRCLE_REVEAL");
  });

  it("a ghost can't vote for a ghost", () => {
    const g = toDay2Circle();
    expect(g.no(as("p12"), { type: "castVote", targetId: "p12" })).toMatch(/yourself/);
  });

  it("switched off, ghosts never vote", () => {
    const g = toDay2Circle({ ghostVote: false });
    expect(g.round().ghostVoterIds).toEqual([]);
    expect(g.no(as("p12"), { type: "castVote", targetId: "p5" })).toMatch(/can't vote/);
  });

  it("a rerun gives the ghost vote back", () => {
    const g = toDay2Circle();
    g.by("p12", { type: "castVote", targetId: "p5" });
    g.host({ type: "rerunVote", reason: "Restart" });
    expect(g.p("p12").ghostVoteUsed).toBe(false);
  });

  it("owner, 27 October: a ghost may use their one vote in a tie revote instead", () => {
    const g = toDay2Circle();
    g.vote({ p1: "p5", p2: "p6" });
    g.reveal();
    expect(g.lastRound().result).toMatchObject({ outcome: "tie", method: "revote" });
    g.host({ type: "startRevote" });
    expect(g.round().kind).toBe("revote");
    expect(g.round().ghostVoterIds).toEqual(["p12"]);
    expect(viewFor(g.state, { kind: "player", playerId: "p12" }).me!.vote).toMatchObject({ canVote: true, asGhost: true });
    g.by("p12", { type: "castVote", targetId: "p5" });
    expect(g.round().ballots[0]).toMatchObject({ voterId: "p12", ghost: true, weight: 1 });
    expect(g.p("p12").ghostVoteUsed).toBe(true);
    expect(g.no(as("p12"), { type: "castVote", targetId: "p6", useDagger: true })).toMatch(/already used your ghost vote|already in/);
  });

  it("owner, 27 October: a ghost may vote in an End Game banishment, never in the End or Banish choice; still once per game", () => {
    const g = dealt(12, { settings: { endGameThreshold: 11 } });
    g.circle();
    g.banish("p12");
    expect(g.phase).toBe("ENDGAME_VOTE");
    expect(g.round().ghostVoterIds).toEqual([]);
    expect(g.no(as("p12"), { type: "castEndgameVote", choice: "end" })).toBeTruthy();
    for (const id of g.alive()) g.by(id, { type: "castEndgameVote", choice: id === "p1" ? "banish" : "end" });
    g.reveal();
    expect(g.phase).toBe("ENDGAME_BANISH");
    expect(g.round().ghostVoterIds).toEqual(["p12"]);
    g.by("p12", { type: "castVote", targetId: "p5" });
    expect(g.round().ballots[0]).toMatchObject({ voterId: "p12", ghost: true });
    expect(g.p("p12").ghostVoteUsed).toBe(true);
  });

  it("switched off, ghosts can't vote in revotes or the End Game either", () => {
    const g = dealt(12, { settings: { endGameThreshold: 11, ghostVote: false } });
    g.circle();
    g.banish("p12");
    for (const id of g.alive()) g.by(id, { type: "castEndgameVote", choice: id === "p1" ? "banish" : "end" });
    g.reveal();
    expect(g.round().ghostVoterIds).toEqual([]);
    expect(g.no(as("p12"), { type: "castVote", targetId: "p5" })).toMatch(/can't vote/);
  });
});
