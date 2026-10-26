import { describe, expect, it } from "vitest";
import { HOST, as, dealt } from "./helpers";

/** 12 players, Traitors p1 p2 p3, banish p12, now NIGHT on day 1. */
const toNight = (o: Parameters<typeof dealt>[1] = {}) => {
  const g = dealt(12, o);
  g.circle();
  g.banish("p12");
  expect(g.phase).toBe("NIGHT");
  return g;
};

describe("night picks (section 5.4)", () => {
  it("only living Traitors pick, never themselves, only living targets", () => {
    const g = toNight();
    expect(g.no(as("p4"), { type: "nightPick", targetId: "p5" })).toMatch(/living Traitor/);
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p1" })).toMatch(/yourself/);
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p12" })).toMatch(/no longer/);
  });

  it("a pick can change until every Traitor has picked; then the night ends", () => {
    const g = toNight();
    g.by("p1", { type: "nightPick", targetId: "p5" });
    g.by("p1", { type: "nightPick", targetId: "p6" });
    expect(g.night().picks.p1).toBe("p6");
    g.by("p2", { type: "nightPick", targetId: "p6" });
    expect(g.phase).toBe("NIGHT");
    g.by("p3", { type: "nightPick", targetId: "p6" });
    expect(g.phase).toBe("MURDER_REVEAL");
    expect(g.p("p6").status).toBe("murdered");
    expect(g.state.day).toBe(2);
  });

  it("majority: the most-picked player dies", () => {
    const g = toNight();
    g.by("p1", { type: "nightPick", targetId: "p5" });
    g.by("p2", { type: "nightPick", targetId: "p5" });
    g.by("p3", { type: "nightPick", targetId: "p6" });
    expect(g.p("p5").status).toBe("murdered");
    expect(g.p("p6").status).toBe("alive");
  });

  it("majority: a tie is broken at random among the tied", () => {
    const victims = new Set<string>();
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const g = toNight();
      g.state = { ...g.state, seed };
      g.by("p1", { type: "nightPick", targetId: "p5" });
      g.by("p2", { type: "nightPick", targetId: "p6" });
      g.by("p3", { type: "nightPick", targetId: "p7" });
      const v = g.night().victimId!;
      expect(["p5", "p6", "p7"]).toContain(v);
      victims.add(v);
    }
    expect(victims.size).toBeGreaterThan(1);
  });

  it("unanimous: any disagreement means nobody dies", () => {
    const g = toNight({ settings: { murderRule: "unanimous" } });
    g.by("p1", { type: "nightPick", targetId: "p5" });
    g.by("p2", { type: "nightPick", targetId: "p5" });
    g.by("p3", { type: "nightPick", targetId: "p6" });
    expect(g.night()).toMatchObject({ victimId: null, reason: "notUnanimous" });
  });

  it("unanimous: everyone agreeing kills; a missing pick blocks it", () => {
    const g = toNight({ settings: { murderRule: "unanimous" } });
    g.pickAll("p5");
    expect(g.p("p5").status).toBe("murdered");
    const h = toNight({ settings: { murderRule: "unanimous" } });
    h.by("p1", { type: "nightPick", targetId: "p5" });
    h.by("p2", { type: "nightPick", targetId: "p5" });
    h.expire();
    expect(h.night()).toMatchObject({ victimId: null, reason: "notUnanimous" });
  });

  it("no valid picks when the timer ends means nobody dies", () => {
    const g = toNight();
    g.expire();
    expect(g.phase).toBe("MURDER_REVEAL");
    expect(g.night()).toMatchObject({ victimId: null, reason: "noValidPicks" });
  });

  it("the host can end the night early with the current picks, or resolve it by hand (logged)", () => {
    const g = toNight();
    g.by("p1", { type: "nightPick", targetId: "p5" });
    g.host({ type: "resolveNight" });
    expect(g.p("p5").status).toBe("murdered");
    const h = toNight();
    expect(h.no(HOST, { type: "resolveNight", targetId: "p7" })).toMatch(/reason/);
    h.host({ type: "resolveNight", targetId: "p7", reason: "Traitors told me in person" });
    expect(h.p("p7").status).toBe("murdered");
    expect(h.state.log[h.state.log.length - 1].override).toBe(true);
  });
});

describe("Traitor-on-Traitor (section 5.4 step 2)", () => {
  it("on: counts only if every other living Traitor picked that Traitor", () => {
    const g = toNight();
    g.by("p1", { type: "nightPick", targetId: "p3" });
    g.by("p2", { type: "nightPick", targetId: "p3" });
    g.by("p3", { type: "nightPick", targetId: "p5" });
    expect(g.p("p3").status).toBe("murdered");
  });

  it("on: a lone pick on a fellow Traitor is dropped", () => {
    const g = toNight();
    g.by("p1", { type: "nightPick", targetId: "p3" });
    g.by("p2", { type: "nightPick", targetId: "p5" });
    g.by("p3", { type: "nightPick", targetId: "p5" });
    expect(g.p("p3").status).toBe("alive");
    expect(g.p("p5").status).toBe("murdered");
  });

  it("on, with 2 Traitors: one picking the other counts, then majority decides", () => {
    const g = toNight({ traitors: ["p1", "p2"], settings: { traitorCount: 2 } });
    g.by("p1", { type: "nightPick", targetId: "p2" });
    g.by("p2", { type: "nightPick", targetId: "p2" === "p2" ? "p5" : "p5" });
    expect(["p2", "p5"]).toContain(g.night().victimId);
  });

  it("on, unanimous: a sacrifice works when every other Traitor agrees (the target's own pick is ignored)", () => {
    const g = toNight({ settings: { murderRule: "unanimous" } });
    g.by("p1", { type: "nightPick", targetId: "p3" });
    g.by("p2", { type: "nightPick", targetId: "p3" });
    g.by("p3", { type: "nightPick", targetId: "p5" });
    expect(g.p("p3").status).toBe("murdered");
  });

  it("off: Traitors can pick only Innocents", () => {
    const g = toNight({ settings: { allowTraitorOnTraitor: false } });
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p2" })).toMatch(/only pick an Innocent/);
  });

  it("a murder can never remove the last Traitor", () => {
    const g = toNight({ traitors: ["p1"], settings: { traitorCount: 1 } });
    expect(g.no(as("p1"), { type: "nightPick", targetId: "p1" })).toMatch(/yourself/);
  });
});

describe("shields (sections 5.4 step 6, 5.6)", () => {
  const withShield = (holders: string[]) => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Spooky Musical Chairs", kind: "individual" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: holders });
    g.circle();
    g.banish("p12");
    return g;
  };

  it("blocks the murder and is used up; the reveal says only that nobody died", () => {
    const g = withShield(["p5"]);
    g.pickAll("p5");
    expect(g.p("p5").status).toBe("alive");
    expect(g.items("p5", "shield")[0].state).toBe("used");
    expect(g.night()).toMatchObject({ victimId: null, reason: "shield" });
    g.host({ type: "revealMurder" });
    const reveal = g.state.events.filter((e) => e.type === "murderRevealed").pop()!;
    expect(reveal.data).toEqual({ nightId: g.night().id, victimId: null, role: null });
  });

  it("expires after one night even if unused", () => {
    const g = withShield(["p5", "p6"]);
    g.pickAll("p7");
    expect(g.items("p5", "shield")[0].state).toBe("expired");
    expect(g.items("p6", "shield")[0].state).toBe("expired");
  });

  it("a player holds at most one shield; the host is warned", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p5"] });
    expect(g.no(HOST, { type: "awardItem", itemType: "shield", playerIds: ["p5"] })).toMatch(/already holds a shield/);
    g.host({ type: "awardItem", itemType: "dagger", playerIds: ["p5"] });
  });

  it("is lost if its holder is banished before the night", () => {
    const g = dealt(12);
    g.host({ type: "startMission", name: "Ring Toss", kind: "individual" });
    g.host({ type: "awardItem", itemType: "shield", playerIds: ["p12"] });
    g.circle();
    g.banish("p12");
    expect(g.items("p12", "shield")[0].state).toBe("lost");
  });
});

describe("suspect poll (section 5.9, rule 10)", () => {
  it("Innocents answer at night; Traitors pick instead; answers can change", () => {
    const g = toNight();
    g.by("p5", { type: "suspectAnswer", targetId: "p6" });
    g.by("p5", { type: "suspectAnswer", targetId: "p7" });
    expect(g.night().suspectAnswers.p5).toBe("p7");
    expect(g.no(as("p1"), { type: "suspectAnswer", targetId: "p6" })).toMatch(/Traitors make their pick/);
    expect(g.no(as("p5"), { type: "suspectAnswer", targetId: "p5" })).toMatch(/other than yourself/);
  });

  it("off: nobody answers", () => {
    const g = toNight({ settings: { suspectPoll: false } });
    expect(g.no(as("p5"), { type: "suspectAnswer", targetId: "p6" })).toMatch(/switched off/);
  });

  it("feeds the suspicion meter at the final reveal", () => {
    const g = toNight();
    g.by("p5", { type: "suspectAnswer", targetId: "p1" });
    g.by("p6", { type: "suspectAnswer", targetId: "p1" });
    g.by("p7", { type: "suspectAnswer", targetId: "p2" });
    g.pickAll("p8");
    g.host({ type: "revealMurder" });
    g.host({ type: "endGameEarly", reason: "Test" });
    expect(g.state.finale!.suspicion).toEqual({ p1: 2, p2: 1 });
  });
});

describe("Traitor chat", () => {
  it("only living Traitors write; off means nobody", () => {
    const g = dealt(12);
    g.by("p1", { type: "sendChat", text: "Let's pick P5" });
    expect(g.state.chat).toHaveLength(1);
    expect(g.no(as("p5"), { type: "sendChat", text: "hi" })).toMatch(/living Traitors/);
    expect(g.no(as("p1"), { type: "sendChat", text: "   " })).toMatch(/Write something/);
    const h = dealt(12, { settings: { traitorChat: false } });
    expect(h.no(as("p1"), { type: "sendChat", text: "hi" })).toMatch(/switched off/);
  });

  it("a banished Traitor can no longer write", () => {
    const g = dealt(12);
    g.circle();
    g.banish("p1");
    expect(g.no(as("p1"), { type: "sendChat", text: "boo" })).toMatch(/living Traitors/);
  });
});

describe("murder reveal and the post-murder check (section 5.2)", () => {
  it("the host reveals; then chooses a mission or the Circle", () => {
    const g = toNight();
    g.pickAll("p5");
    expect(g.no(HOST, { type: "openCircle" })).toMatch(/Reveal the murder first/);
    g.host({ type: "revealMurder" });
    expect(g.no(HOST, { type: "revealMurder" })).toMatch(/already been revealed/);
    g.host({ type: "openCircle" });
    expect(g.phase).toBe("CIRCLE_DEBATE");
  });

  it("goes to the finale if 2 or fewer are alive after a murder", () => {
    const g = dealt(5, { traitors: ["p1"], settings: { traitorCount: 1, endGameThreshold: 2 } });
    g.circle();
    g.banish("p5");
    g.pickAll("p4");
    g.host({ type: "revealMurder" });
    g.circle();
    g.banish("p3");
    expect(g.phase).toBe("FINALE");
    expect(g.state.finale!.winner).toBe("traitors");
  });
});
